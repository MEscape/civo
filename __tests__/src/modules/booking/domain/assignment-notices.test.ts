import { describe, expect, it } from 'vitest';

import { assignmentNoticesOf } from '@modules/booking/domain/models/actor-message';
import { toBookableResourceId } from '@modules/booking/domain/models/ids';
import { addMinutes } from '@modules/booking/domain/time/instant';

import { makeBooking, minutes, unitOf } from '../support/booking-fixtures';

const served = (...ids: Array<string | null>) =>
  makeBooking({ assignments: ids.map((id) => unitOf(id)) });

describe('what an employee is told about a change (BD-11)', () => {
  it('tells who is taken on and who is taken off, nobody else', () => {
    expect(assignmentNoticesOf(served('anna', null), served('anna', 'ben'))).toEqual([
      { resourceId: 'ben', type: 'assigned' },
    ]);
    expect(assignmentNoticesOf(served('anna', 'ben'), served('anna', null))).toEqual([
      { resourceId: 'ben', type: 'unassigned' },
    ]);
    expect(assignmentNoticesOf(served('anna'), served('ben'))).toEqual([
      { resourceId: 'ben', type: 'assigned' },
      { resourceId: 'anna', type: 'unassigned' },
    ]);
  });

  it('tells everyone who served a cancelled booking that it is cancelled', () => {
    const before = served('anna', 'ben');
    expect(assignmentNoticesOf(before, { ...before, status: 'cancelled' })).toEqual([
      { resourceId: 'anna', type: 'cancelled' },
      { resourceId: 'ben', type: 'cancelled' },
    ]);
  });

  it('tells those who keep a moved booking that it moved', () => {
    const before = served('anna');
    const moved = {
      ...before,
      start: addMinutes(before.start, minutes(60)),
      end: addMinutes(before.end, minutes(60)),
    };
    expect(assignmentNoticesOf(before, moved)).toEqual([
      { resourceId: 'anna', type: 'rescheduled' },
    ]);
  });

  it('tells nobody about a hold, the end of a booking, or a room', () => {
    const held = { ...served('anna'), status: 'held' as const };
    expect(assignmentNoticesOf(null, held)).toEqual([]);
    expect(assignmentNoticesOf(held, { ...held, status: 'cancelled' })).toEqual([]);
    expect(assignmentNoticesOf(served('anna'), { ...served('anna'), status: 'completed' })).toEqual(
      [],
    );
    expect(assignmentNoticesOf(served('anna'), served('anna'))).toEqual([]);
    const room = makeBooking({ assignments: [unitOf('room-1', { resourceType: 'room' })] });
    expect(assignmentNoticesOf(room, { ...room, status: 'cancelled' })).toEqual([]);
    expect(assignmentNoticesOf(null, room)).toEqual([]);
  });

  it('tells the employee a booking was assigned to when it is made, or when its hold is confirmed', () => {
    const held = { ...served('anna'), status: 'held' as const };
    const expected = [{ resourceId: toBookableResourceId('anna'), type: 'assigned' }];

    // Made by staff: no booking before.
    expect(assignmentNoticesOf(null, served('anna'))).toEqual(expected);
    // Booked on the public site: the hold is confirmed.
    expect(assignmentNoticesOf(held, served('anna'))).toEqual(expected);
  });

  it('tells nobody when the units wait for an employee, because nobody is on them yet', () => {
    const open = makeBooking({ assignments: [unitOf(null)] });

    expect(assignmentNoticesOf(null, open)).toEqual([]);
  });
});
