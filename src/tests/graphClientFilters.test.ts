import test from 'node:test';
import assert from 'node:assert/strict';
import { isActiveUserShift, isInSyncWindow } from '../services/graphClient.js';
import type { Shift } from '../types/index.js';

function buildShift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: 'shift-1',
    createdDateTime: '2026-01-01T00:00:00.000Z',
    lastModifiedDateTime: '2026-01-01T00:00:00.000Z',
    schedulingGroupId: null,
    userId: 'user-1',
    isStagedForDeletion: false,
    sharedShift: {
      displayName: 'Morning',
      notes: null,
      startDateTime: '2026-02-04T08:00:00.000Z',
      endDateTime: '2026-02-04T16:00:00.000Z',
      theme: 'blue',
      activities: [],
    },
    draftShift: null,
    ...overrides,
  };
}

test('isActiveUserShift accepts only active shifts for the current user', () => {
  const mine = buildShift();
  const someoneElse = buildShift({ userId: 'user-2' });
  const deleted = buildShift({ isStagedForDeletion: true });
  const noSharedShift = buildShift({ sharedShift: null });

  assert.equal(isActiveUserShift(mine, 'user-1'), true);
  assert.equal(isActiveUserShift(someoneElse, 'user-1'), false);
  assert.equal(isActiveUserShift(deleted, 'user-1'), false);
  assert.equal(isActiveUserShift(noSharedShift, 'user-1'), false);
});

test('isInSyncWindow includes ongoing and upcoming shifts, excludes ended/future-outside-window', () => {
  const now = new Date('2026-02-04T12:00:00.000Z');
  const endDate = new Date('2026-02-10T00:00:00.000Z');

  const ongoing = buildShift({
    sharedShift: {
      ...buildShift().sharedShift!,
      startDateTime: '2026-02-04T08:00:00.000Z',
      endDateTime: '2026-02-04T16:00:00.000Z',
    },
  });
  const upcoming = buildShift({
    sharedShift: {
      ...buildShift().sharedShift!,
      startDateTime: '2026-02-09T08:00:00.000Z',
      endDateTime: '2026-02-09T16:00:00.000Z',
    },
  });
  const ended = buildShift({
    sharedShift: {
      ...buildShift().sharedShift!,
      startDateTime: '2026-02-03T08:00:00.000Z',
      endDateTime: '2026-02-03T16:00:00.000Z',
    },
  });
  const beyondWindow = buildShift({
    sharedShift: {
      ...buildShift().sharedShift!,
      startDateTime: '2026-02-11T08:00:00.000Z',
      endDateTime: '2026-02-11T16:00:00.000Z',
    },
  });

  assert.equal(isInSyncWindow(ongoing, now, endDate), true);
  assert.equal(isInSyncWindow(upcoming, now, endDate), true);
  assert.equal(isInSyncWindow(ended, now, endDate), false);
  assert.equal(isInSyncWindow(beyondWindow, now, endDate), false);
});
