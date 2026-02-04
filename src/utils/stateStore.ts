import { readFile, writeFile } from 'fs/promises';
import type { SyncState, SyncRecord, LegacySyncState } from '../types/index.js';

const CURRENT_VERSION = 1;

const EMPTY_STATE: SyncState = {
  version: CURRENT_VERSION,
  lastSync: '',
  records: {},
};

function isLegacyState(state: unknown): state is LegacySyncState {
  return (
    typeof state === 'object' &&
    state !== null &&
    'lastSync' in state &&
    'records' in state &&
    !('version' in state)
  );
}

function migrateFromLegacy(legacy: LegacySyncState): SyncState {
  return {
    version: CURRENT_VERSION,
    lastSync: legacy.lastSync,
    records: legacy.records,
  };
}

export class StateStore {
  private filePath: string;
  private state: SyncState = EMPTY_STATE;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async load(): Promise<void> {
    try {
      const content = await readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(content);

      // Handle legacy state (no version field)
      if (isLegacyState(parsed)) {
        console.log('📦 Migrating state file to version 1...');
        this.state = migrateFromLegacy(parsed);
        await this.save(true); // Persist the migration, preserving original lastSync
        return;
      }

      // Check version compatibility
      if (parsed.version > CURRENT_VERSION) {
        throw new Error(
          `State file version ${parsed.version} is newer than supported version ${CURRENT_VERSION}. ` +
          `Please upgrade shifts-gcal-connector.`
        );
      }

      this.state = parsed as SyncState;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, start fresh
        this.state = { ...EMPTY_STATE, records: {} };
        return;
      }
      throw error;
    }
  }

  async save(preserveLastSync = false): Promise<void> {
    if (!preserveLastSync) {
      this.state.lastSync = new Date().toISOString();
    }
    this.state.version = CURRENT_VERSION;
    await writeFile(this.filePath, JSON.stringify(this.state, null, 2));
  }

  getRecord(shiftId: string): SyncRecord | undefined {
    return this.state.records[shiftId];
  }

  setRecord(shiftId: string, record: SyncRecord): void {
    this.state.records[shiftId] = record;
  }

  deleteRecord(shiftId: string): void {
    delete this.state.records[shiftId];
  }

  getAllShiftIds(): string[] {
    return Object.keys(this.state.records);
  }

  getLastSync(): string {
    return this.state.lastSync;
  }

  getVersion(): number {
    return this.state.version;
  }
}
