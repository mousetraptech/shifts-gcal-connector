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

export interface SyncOptions {
  dryRun?: boolean;
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

  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    const { dryRun = false } = options;

    const result: SyncResult = {
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      errors: [],
    };

    if (dryRun) {
      console.log('\n🔍 Starting dry run (no changes will be made)...\n');
    } else {
      console.log('\n🔄 Starting sync...\n');
    }

    // Fetch shifts from Teams
    const shifts = await this.graphClient.getMyShifts(this.config.sync.daysAhead);
    const currentShiftIds = new Set(shifts.map((s) => s.id));

    // Process each shift
    for (const shift of shifts) {
      try {
        await this.processShift(shift, result, dryRun);
      } catch (error: any) {
        result.errors.push(`Failed to sync shift ${shift.id}: ${error.message}`);
      }
    }

    // Handle deletions - shifts that were previously synced but no longer exist
    const previousShiftIds = this.stateStore.getAllShiftIds();
    for (const shiftId of previousShiftIds) {
      if (!currentShiftIds.has(shiftId)) {
        try {
          await this.deleteShift(shiftId, result, dryRun);
        } catch (error: any) {
          result.errors.push(`Failed to delete shift ${shiftId}: ${error.message}`);
        }
      }
    }

    // Save state (only if not dry run)
    if (!dryRun) {
      await this.stateStore.save();
    }

    this.printSummary(result, dryRun);
    return result;
  }

  private async processShift(shift: Shift, result: SyncResult, dryRun: boolean): Promise<void> {
    const eventId = generateEventId(shift.id);
    const existingRecord = this.stateStore.getRecord(shift.id);

    // Check if shift has changed
    if (existingRecord && !hasShiftChanged(shift, existingRecord.lastModified)) {
      result.skipped++;
      return;
    }

    // Convert shift to calendar event
    const event = shiftToCalendarEvent(shift, {
      defaultTitle: this.config.sync.defaultEventTitle,
      defaultColor: this.config.sync.defaultEventColor,
      useTeamsColors: this.config.sync.useTeamsColors,
    });
    if (!event) {
      result.skipped++;
      return;
    }

    if (dryRun) {
      // Dry run - just log what would happen
      if (existingRecord) {
        result.updated++;
        console.log(`  ✏️  Would update: ${event.summary} (${formatDate(shift.sharedShift!.startDateTime)})`);
      } else {
        result.created++;
        console.log(`  ✅ Would create: ${event.summary} (${formatDate(shift.sharedShift!.startDateTime)})`);
      }
    } else {
      // Actually perform the upsert
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
  }

  private async deleteShift(shiftId: string, result: SyncResult, dryRun: boolean): Promise<void> {
    const record = this.stateStore.getRecord(shiftId);
    if (!record) {
      return;
    }

    if (dryRun) {
      result.deleted++;
      console.log(`  🗑️  Would delete: Event for shift ${shiftId}`);
    } else {
      await this.calendarClient.deleteEvent(record.calendarEventId);
      this.stateStore.deleteRecord(shiftId);
      result.deleted++;
      console.log(`  🗑️  Deleted: Event for shift ${shiftId}`);
    }
  }

  private printSummary(result: SyncResult, dryRun: boolean): void {
    console.log('\n' + '━'.repeat(50));
    console.log(dryRun ? '📊 Dry Run Summary' : '📊 Sync Summary');
    console.log('━'.repeat(50));
    console.log(`  ${dryRun ? 'Would create' : 'Created'}: ${result.created}`);
    console.log(`  ${dryRun ? 'Would update' : 'Updated'}: ${result.updated}`);
    console.log(`  ${dryRun ? 'Would delete' : 'Deleted'}: ${result.deleted}`);
    console.log(`  Skipped: ${result.skipped}`);

    if (result.errors.length > 0) {
      console.log(`  Errors:  ${result.errors.length}`);
      for (const error of result.errors) {
        console.log(`    ⚠️  ${error}`);
      }
    }

    if (dryRun) {
      console.log('\n  ℹ️  No changes were made (dry run)');
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
