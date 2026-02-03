import type { Config, Shift } from '../types/index.js';
import { GraphClient } from './graphClient.js';
import { CalendarClient } from './calendarClient.js';
import { StateStore } from '../utils/stateStore.js';
import {
  shiftToCalendarEvent,
  generateEventId,
  hasShiftChanged,
} from '../utils/dataMapper.js';

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  errors: string[];
}

export class SyncService {
  private graphClient: GraphClient;
  private calendarClient: CalendarClient;
  private stateStore: StateStore;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.graphClient = new GraphClient(config);
    this.calendarClient = new CalendarClient(config);
    this.stateStore = new StateStore(config.sync.stateFilePath);
  }

  async authenticate(): Promise<void> {
    await this.graphClient.authenticate();
    await this.calendarClient.authenticate();
    await this.stateStore.load();
  }

  async sync(): Promise<SyncResult> {
    const result: SyncResult = {
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      errors: [],
    };

    console.log('\n🔄 Starting sync...\n');

    // Fetch shifts from Teams
    const shifts = await this.graphClient.getMyShifts(this.config.sync.daysAhead);
    const currentShiftIds = new Set(shifts.map((s) => s.id));

    // Process each shift
    for (const shift of shifts) {
      try {
        await this.processShift(shift, result);
      } catch (error: any) {
        result.errors.push(`Failed to sync shift ${shift.id}: ${error.message}`);
      }
    }

    // Handle deletions - shifts that were previously synced but no longer exist
    const previousShiftIds = this.stateStore.getAllShiftIds();
    for (const shiftId of previousShiftIds) {
      if (!currentShiftIds.has(shiftId)) {
        try {
          await this.deleteShift(shiftId, result);
        } catch (error: any) {
          result.errors.push(`Failed to delete shift ${shiftId}: ${error.message}`);
        }
      }
    }

    // Save state
    await this.stateStore.save();

    this.printSummary(result);
    return result;
  }

  private async processShift(shift: Shift, result: SyncResult): Promise<void> {
    const eventId = generateEventId(shift.id);
    const existingRecord = this.stateStore.getRecord(shift.id);

    // Check if shift has changed
    if (existingRecord && !hasShiftChanged(shift, existingRecord.lastModified)) {
      result.skipped++;
      return;
    }

    // Convert shift to calendar event
    const event = shiftToCalendarEvent(shift, this.config.sync.defaultEventTitle);
    if (!event) {
      result.skipped++;
      return;
    }

    // Upsert the event
    const createdId = await this.calendarClient.upsertEvent(eventId, event);

    // Update state
    this.stateStore.setRecord(shift.id, {
      calendarEventId: createdId,
      lastModified: shift.lastModifiedDateTime,
    });

    if (existingRecord) {
      result.updated++;
      console.log(`  ✏️  Updated: ${event.summary} (${formatDate(shift.sharedShift!.startDateTime)})`);
    } else {
      result.created++;
      console.log(`  ✅ Created: ${event.summary} (${formatDate(shift.sharedShift!.startDateTime)})`);
    }
  }

  private async deleteShift(shiftId: string, result: SyncResult): Promise<void> {
    const record = this.stateStore.getRecord(shiftId);
    if (!record) {
      return;
    }

    await this.calendarClient.deleteEvent(record.calendarEventId);
    this.stateStore.deleteRecord(shiftId);
    result.deleted++;
    console.log(`  🗑️  Deleted: Event for shift ${shiftId}`);
  }

  private printSummary(result: SyncResult): void {
    console.log('\n' + '━'.repeat(50));
    console.log('📊 Sync Summary');
    console.log('━'.repeat(50));
    console.log(`  Created: ${result.created}`);
    console.log(`  Updated: ${result.updated}`);
    console.log(`  Deleted: ${result.deleted}`);
    console.log(`  Skipped: ${result.skipped}`);

    if (result.errors.length > 0) {
      console.log(`  Errors:  ${result.errors.length}`);
      for (const error of result.errors) {
        console.log(`    ⚠️  ${error}`);
      }
    }

    console.log('━'.repeat(50) + '\n');
  }
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
