import * as msal from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { readFile, writeFile } from 'fs/promises';
import { addDays } from 'date-fns';
import type { Config, Shift, ShiftsResponse } from '../types/index.js';

const SCOPES = ['https://graph.microsoft.com/Schedule.Read.All'];

export interface MyShiftsResult {
  shiftsToSync: Shift[];
  allActiveShiftIds: Set<string>;
}

export function isActiveUserShift(shift: Shift, userId: string): boolean {
  return shift.userId === userId && !shift.isStagedForDeletion && !!shift.sharedShift;
}

export function isInSyncWindow(shift: Shift, now: Date, endDate: Date): boolean {
  if (!shift.sharedShift) {
    return false;
  }

  const shiftStart = new Date(shift.sharedShift.startDateTime);
  const shiftEnd = new Date(shift.sharedShift.endDateTime);

  // Include overlapping shifts so ongoing events are not skipped.
  return shiftEnd >= now && shiftStart <= endDate;
}

export class GraphClient {
  private client: Client | null = null;
  private config: Config;
  private msalClient: msal.PublicClientApplication | null = null;
  private tokenCachePath: string;

  constructor(config: Config) {
    this.config = config;
    this.tokenCachePath = config.tokenCachePath;
  }

  async authenticate(): Promise<void> {
    const msalConfig: msal.Configuration = {
      auth: {
        clientId: this.config.azure.clientId,
        authority: `https://login.microsoftonline.com/${this.config.azure.tenantId}`,
      },
    };

    this.msalClient = new msal.PublicClientApplication(msalConfig);

    // Load cached tokens
    let cachedTokens: msal.TokenCache | null = null;
    try {
      const cacheData = await readFile(this.tokenCachePath, 'utf-8');
      this.msalClient.getTokenCache().deserialize(cacheData);
      console.log('📂 Loaded cached tokens');
    } catch {
      // No cache file yet
    }

    // Try to get token silently first
    const accounts = await this.msalClient.getTokenCache().getAllAccounts();
    let accessToken: string;

    if (accounts.length > 0) {
      try {
        const silentResult = await this.msalClient.acquireTokenSilent({
          account: accounts[0],
          scopes: SCOPES,
        });
        accessToken = silentResult.accessToken;
        console.log('✅ Using cached Microsoft token');
      } catch {
        // Silent acquisition failed, need interactive
        accessToken = await this.acquireTokenInteractive();
      }
    } else {
      // No cached accounts, need interactive
      accessToken = await this.acquireTokenInteractive();
    }

    // Save the cache
    const cacheData = this.msalClient.getTokenCache().serialize();
    await writeFile(this.tokenCachePath, cacheData);

    // Create Graph client with the token
    this.client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      },
    });

    console.log('✅ Microsoft Graph client initialized');
  }

  private async acquireTokenInteractive(): Promise<string> {
    if (!this.msalClient) {
      throw new Error('MSAL client not initialized');
    }

    const deviceCodeRequest: msal.DeviceCodeRequest = {
      scopes: SCOPES,
      deviceCodeCallback: (response) => {
        console.log('\n🔐 Microsoft Authentication Required');
        console.log('━'.repeat(50));
        console.log(response.message);
        console.log('━'.repeat(50) + '\n');
      },
    };

    const result = await this.msalClient.acquireTokenByDeviceCode(deviceCodeRequest);

    if (!result) {
      throw new Error('Failed to acquire token - no result returned');
    }

    // Save cache after successful auth
    const cacheData = this.msalClient.getTokenCache().serialize();
    await writeFile(this.tokenCachePath, cacheData);

    return result.accessToken;
  }

  async getMyShifts(daysAhead: number = 30): Promise<MyShiftsResult> {
    if (!this.client) {
      throw new Error('Graph client not authenticated. Call authenticate() first.');
    }

    const teamId = this.config.azure.teamId;
    const now = new Date();
    const endDate = addDays(now, daysAhead);

    console.log(`📋 Fetching shifts from configured team...`);

    const allActiveShifts: Shift[] = [];

    try {
      // Get shifts for the configured team (no filter - API doesn't support range queries well)
      const shiftsUrl = `/teams/${teamId}/schedule/shifts`;

      let shiftsResponse: ShiftsResponse = await this.client
        .api(shiftsUrl)
        .get();

      // Get current user ID to filter shifts
      const meResponse = await this.client.api('/me').select('id').get();
      const myUserId = meResponse.id;

      // Filter client-side: my active shifts across all pages.
      const myShifts = shiftsResponse.value.filter((shift) => isActiveUserShift(shift, myUserId));
      allActiveShifts.push(...myShifts);

      // Handle pagination
      while (shiftsResponse['@odata.nextLink']) {
        shiftsResponse = await this.client
          .api(shiftsResponse['@odata.nextLink'])
          .get();

        const moreShifts = shiftsResponse.value.filter((shift) => isActiveUserShift(shift, myUserId));
        allActiveShifts.push(...moreShifts);
      }
    } catch (error: any) {
      if (error.statusCode === 404 || error.code === 'NotFound') {
        console.log('⚠️  Team not found or Shifts not enabled for this team.');
        return {
          shiftsToSync: [],
          allActiveShiftIds: new Set<string>(),
        };
      }
      throw error;
    }

    const shiftsToSync = allActiveShifts.filter((shift) => isInSyncWindow(shift, now, endDate));
    console.log(`📅 Found ${shiftsToSync.length} shift(s) in the next ${daysAhead} days`);

    return {
      shiftsToSync,
      allActiveShiftIds: new Set(allActiveShifts.map((shift) => shift.id)),
    };
  }
}
