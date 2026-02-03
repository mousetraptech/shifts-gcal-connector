// Microsoft Graph Shift types
export interface ShiftActivity {
  isPaid: boolean;
  startDateTime: string;
  endDateTime: string;
  code: string;
  displayName: string;
  theme?: ShiftTheme;
}

export type ShiftTheme =
  | 'white'
  | 'blue'
  | 'green'
  | 'purple'
  | 'pink'
  | 'yellow'
  | 'gray'
  | 'darkBlue'
  | 'darkGreen'
  | 'darkPurple'
  | 'darkPink'
  | 'darkYellow';

export interface ShiftItem {
  displayName: string | null;
  notes: string | null;
  startDateTime: string;
  endDateTime: string;
  theme: ShiftTheme;
  activities: ShiftActivity[];
}

export interface Shift {
  id: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  schedulingGroupId: string | null;
  userId: string;
  isStagedForDeletion: boolean;
  sharedShift: ShiftItem | null;
  draftShift: ShiftItem | null;
}

export interface ShiftsResponse {
  '@odata.context'?: string;
  '@odata.nextLink'?: string;
  value: Shift[];
}

// Sync state types
export interface SyncRecord {
  calendarEventId: string;
  lastModified: string;
}

export interface SyncState {
  lastSync: string;
  records: Record<string, SyncRecord>;
}

// Google Calendar event (simplified)
export interface CalendarEventInput {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  colorId?: string;
  extendedProperties?: {
    private?: Record<string, string>;
  };
}

// Config types
export interface Config {
  azure: {
    tenantId: string;
    clientId: string;
    teamId: string;
  };
  google: {
    calendarId: string;
    credentialsPath: string;
    tokenPath: string;
  };
  sync: {
    daysAhead: number;
    stateFilePath: string;
  };
  tokenCachePath: string;
}
