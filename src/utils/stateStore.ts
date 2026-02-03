import { readFile, writeFile } from 'fs/promises';
import type { SyncState, SyncRecord } from '../types/index.js';

const EMPTY_STATE: SyncState = {
  lastSync: '',
  records: {},
};

export class StateStore {
  private filePath: string;
  private state: SyncState = EMPTY_STATE;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async load(): Promise<void> {
    try {
      const content = await readFile(this.filePath, 'utf-8');
      this.state = JSON.parse(content);
    } catch {
      // File doesn't exist or is invalid, start fresh
      this.state = { ...EMPTY_STATE, records: {} };
    }
  }

  async save(): Promise<void> {
    this.state.lastSync = new Date().toISOString();
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
}
