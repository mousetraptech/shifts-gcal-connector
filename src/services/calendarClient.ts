import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';
import { readFile, writeFile } from 'fs/promises';
import { createInterface } from 'readline';
import type { Config, CalendarEventInput } from '../types/index.js';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

export class CalendarClient {
  private config: Config;
  private oauth2Client: OAuth2Client | null = null;
  private calendar: calendar_v3.Calendar | null = null;

  constructor(config: Config) {
    this.config = config;
  }

  async authenticate(): Promise<void> {
    // Load client credentials
    let credentials: any;
    try {
      const content = await readFile(this.config.google.credentialsPath, 'utf-8');
      credentials = JSON.parse(content);
    } catch {
      throw new Error(
        `Could not load Google credentials from ${this.config.google.credentialsPath}. ` +
          'Download OAuth 2.0 credentials from Google Cloud Console.'
      );
    }

    const { client_id, client_secret, redirect_uris } =
      credentials.installed || credentials.web;

    this.oauth2Client = new OAuth2Client(client_id, client_secret, redirect_uris?.[0]);

    // Try to load saved token
    try {
      const tokenContent = await readFile(this.config.google.tokenPath, 'utf-8');
      const token: Credentials = JSON.parse(tokenContent);
      this.oauth2Client.setCredentials(token);

      // Check if token needs refresh
      if (token.expiry_date && token.expiry_date < Date.now()) {
        console.log('🔄 Refreshing Google token...');
        const { credentials: refreshedToken } = await this.oauth2Client.refreshAccessToken();
        this.oauth2Client.setCredentials(refreshedToken);
        await writeFile(this.config.google.tokenPath, JSON.stringify(refreshedToken, null, 2));
      }
    } catch {
      // No token saved, need to authorize
      await this.authorize();
    }

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    console.log('✅ Google Calendar client initialized');
  }

  private async authorize(): Promise<void> {
    if (!this.oauth2Client) {
      throw new Error('OAuth2 client not initialized');
    }

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    console.log('\n🔐 Google Authentication Required');
    console.log('━'.repeat(50));
    console.log('Visit this URL to authorize the application:\n');
    console.log(authUrl);
    console.log('\n━'.repeat(50));

    const code = await this.promptForCode();
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);

    // Save token for future use
    await writeFile(this.config.google.tokenPath, JSON.stringify(tokens, null, 2));
    console.log('✅ Google token saved');
  }

  private async promptForCode(): Promise<string> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question('\nEnter the authorization code: ', (code) => {
        rl.close();
        resolve(code.trim());
      });
    });
  }

  async createEvent(event: CalendarEventInput): Promise<string> {
    if (!this.calendar) {
      throw new Error('Calendar client not authenticated');
    }

    const response = await this.calendar.events.insert({
      calendarId: this.config.google.calendarId,
      requestBody: event,
    });

    return response.data.id!;
  }

  async updateEvent(eventId: string, event: CalendarEventInput): Promise<void> {
    if (!this.calendar) {
      throw new Error('Calendar client not authenticated');
    }

    await this.calendar.events.update({
      calendarId: this.config.google.calendarId,
      eventId,
      requestBody: event,
    });
  }

  async deleteEvent(eventId: string): Promise<void> {
    if (!this.calendar) {
      throw new Error('Calendar client not authenticated');
    }

    try {
      await this.calendar.events.delete({
        calendarId: this.config.google.calendarId,
        eventId,
      });
    } catch (error: any) {
      // Ignore if event doesn't exist
      if (error.code !== 404) {
        throw error;
      }
    }
  }

  async upsertEvent(eventId: string, event: CalendarEventInput): Promise<string> {
    if (!this.calendar) {
      throw new Error('Calendar client not authenticated');
    }

    try {
      // Try to update first
      await this.calendar.events.update({
        calendarId: this.config.google.calendarId,
        eventId,
        requestBody: { ...event, id: eventId },
      });
      return eventId;
    } catch (error: any) {
      if (error.code === 404) {
        // Event doesn't exist, create it
        const response = await this.calendar.events.insert({
          calendarId: this.config.google.calendarId,
          requestBody: { ...event, id: eventId },
        });
        return response.data.id!;
      }
      throw error;
    }
  }

  async getEvent(eventId: string): Promise<calendar_v3.Schema$Event | null> {
    if (!this.calendar) {
      throw new Error('Calendar client not authenticated');
    }

    try {
      const response = await this.calendar.events.get({
        calendarId: this.config.google.calendarId,
        eventId,
      });
      return response.data;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }
}
