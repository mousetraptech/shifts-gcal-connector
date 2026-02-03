import type { Shift, ShiftTheme, CalendarEventInput } from '../types/index.js';

// Map Teams Shift themes to Google Calendar color IDs
// https://developers.google.com/calendar/api/v3/reference/colors/get
const THEME_TO_COLOR: Record<ShiftTheme, string> = {
  white: '8',      // Graphite (neutral)
  blue: '9',       // Bold Blue
  green: '10',     // Bold Green
  purple: '3',     // Grape
  pink: '4',       // Flamingo
  yellow: '5',     // Banana
  gray: '8',       // Graphite
  darkBlue: '9',   // Bold Blue
  darkGreen: '10', // Bold Green
  darkPurple: '3', // Grape
  darkPink: '4',   // Flamingo
  darkYellow: '5', // Banana
};

export function generateEventId(shiftId: string): string {
  // Google Calendar event IDs must be lowercase alphanumeric
  // Remove non-alphanumeric characters and convert to lowercase
  return 'shift' + shiftId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export function shiftToCalendarEvent(
  shift: Shift,
  defaultTitle: string,
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
): CalendarEventInput | null {
  const shiftData = shift.sharedShift;

  if (!shiftData) {
    return null;
  }

  const title = shiftData.displayName || defaultTitle;
  const colorId = THEME_TO_COLOR[shiftData.theme] || '8';

  // Build description from notes and activities
  const descriptionParts: string[] = [];

  if (shiftData.notes) {
    descriptionParts.push(shiftData.notes);
  }

  if (shiftData.activities && shiftData.activities.length > 0) {
    descriptionParts.push('\n📋 Activities:');
    for (const activity of shiftData.activities) {
      const timeRange = formatTimeRange(activity.startDateTime, activity.endDateTime);
      const paidLabel = activity.isPaid ? '' : ' (unpaid)';
      descriptionParts.push(`• ${activity.displayName || activity.code}${paidLabel} - ${timeRange}`);
    }
  }

  descriptionParts.push('\n---\nSynced from Microsoft Teams Shifts');

  return {
    summary: title,
    description: descriptionParts.join('\n'),
    start: {
      dateTime: shiftData.startDateTime,
      timeZone,
    },
    end: {
      dateTime: shiftData.endDateTime,
      timeZone,
    },
    colorId,
    extendedProperties: {
      private: {
        shiftId: shift.id,
        source: 'teams-shifts-sync',
        lastModified: shift.lastModifiedDateTime,
      },
    },
  };
}

function formatTimeRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

  return `${formatTime(startDate)} - ${formatTime(endDate)}`;
}

export function hasShiftChanged(
  shift: Shift,
  lastModified: string | undefined
): boolean {
  if (!lastModified) {
    return true;
  }
  return new Date(shift.lastModifiedDateTime) > new Date(lastModified);
}
