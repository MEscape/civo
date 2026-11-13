import { describe, expect, it } from 'vitest';

import { toActorMessage } from '@modules/booking/infrastructure/prisma/actor-message-record-mapper';
import {
  toPreferenceColumns,
  toPreferences,
} from '@modules/booking/infrastructure/prisma/employee-preference-record-mapper';

const stamp = { epochMilliseconds: Date.parse('2027-01-14T07:02:00Z') };
const message = {
  id: 'm-1',
  type: 'assigned',
  bookingId: 'b-1',
  params: {
    serviceId: 's-1',
    locationId: 'l-1',
    start: '2027-01-14T09:30:00.000Z',
    end: '2027-01-14T10:00:00.000Z',
  },
  createdAt: stamp,
  readAt: null,
};

/** A message about the calendar itself: no booking, the parts a manager changed. */
const calendar = {
  ...message,
  id: 'm-2',
  type: 'calendar_changed',
  bookingId: null,
  params: { locationId: 'l-1', parts: ['hours', 'qualifications'] },
};

describe('stored messages', () => {
  it('read back as the inbox reads them', () => {
    const read = toActorMessage(message)._unsafeUnwrap();
    expect(read).toMatchObject({ type: 'assigned', bookingId: 'b-1', readAt: null });
    expect('end' in read && read.end - read.start).toBe(30 * 60 * 1000);
  });

  it('read back a message about the calendar with the parts that changed and no booking', () => {
    expect(toActorMessage(calendar)._unsafeUnwrap()).toMatchObject({
      type: 'calendar_changed',
      locationId: 'l-1',
      parts: ['hours', 'qualifications'],
    });
  });

  it.each([
    { ...message, type: 'reminder' },
    { ...message, params: 'text' },
    { ...message, params: { ...message.params, start: '09:30' } },
    { ...message, params: { ...message.params, serviceId: '' } },
    { ...message, bookingId: null },
    { ...calendar, params: { locationId: 'l-1', parts: ['hours', 'pizza'] } },
    { ...calendar, params: { locationId: 'l-1' } },
  ])('refuse a row in another shape (%#)', (record) => {
    expect(toActorMessage(record)._unsafeUnwrapErr().code).toBe('booking.persistence_failed');
  });
});

describe('stored preferences', () => {
  it('round-trip, the window as both minute columns or neither', () => {
    const preferences = toPreferences({
      resourceId: 'r-1',
      serviceIds: ['s-1'],
      windowStart: 480,
      windowEnd: 780,
    })._unsafeUnwrap();
    expect(preferences.serviceIds).toEqual(['s-1']);
    expect(toPreferenceColumns(preferences)).toMatchObject({ windowStart: 480, windowEnd: 780 });
    expect(toPreferenceColumns({ ...preferences, window: null })).toMatchObject({
      windowStart: null,
      windowEnd: null,
    });
  });

  it('refuse a list that is not a list of ids and a window that is not one', () => {
    const base = {
      resourceId: 'r-1',
      serviceIds: [],
      windowStart: null,
      windowEnd: null,
    };
    expect(toPreferences({ ...base, serviceIds: [1] }).isErr()).toBe(true);
    expect(toPreferences({ ...base, windowStart: 600, windowEnd: 500 }).isErr()).toBe(true);
  });
});
