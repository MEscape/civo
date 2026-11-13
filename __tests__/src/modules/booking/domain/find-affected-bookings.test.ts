import { describe, expect, it } from 'vitest';

import { findAffectedBookings } from '@modules/booking/domain/impact/find-affected-bookings';
import type { Booking } from '@modules/booking/domain/models/booking';
import { toBookableResourceId, toBookingId } from '@modules/booking/domain/models/ids';
import { addMinutes } from '@modules/booking/domain/time/instant';

import {
  LOCATION,
  MONDAY,
  NOW,
  OTHER_LOCATION,
  makeBooking,
  minutes,
  unitOf,
} from '../support/booking-fixtures';
import { at, between } from '../support/time-fixtures';

function booking(id: string, from: string, to: string, overrides: Partial<Booking> = {}): Booking {
  const start = at(MONDAY, from);
  const end = at(MONDAY, to);
  return makeBooking({
    id: toBookingId(id),
    start,
    end,
    occupied: { start, end },
    assignments: [unitOf('anna')],
    ...overrides,
  });
}

function idsOf(affected: ReadonlyArray<{ bookingId: string }>): string[] {
  return affected.map((entry) => entry.bookingId);
}

describe('when the opening hours shrink', () => {
  const morning = booking('b-1000', '10:00', '10:30');
  const lateAfternoon = booking('b-1630', '16:30', '17:00');
  const loss = (until: string) => ({
    kind: 'opening-hours' as const,
    locationId: LOCATION,
    remaining: [between(MONDAY, '08:00', until)],
  });

  it('lists the bookings left outside, earliest first, with the reason', () => {
    const affected = findAffectedBookings({
      bookings: [lateAfternoon, morning, booking('b-1500', '15:00', '15:30')],
      loss: loss('15:00'),
      now: NOW,
    });

    expect(affected).toEqual([
      { bookingId: 'b-1500', reason: 'outside-opening-hours' },
      { bookingId: 'b-1630', reason: 'outside-opening-hours' },
    ]);
  });

  it('keeps a booking that ends exactly at closing time, and loses one that runs a minute over', () => {
    expect(
      findAffectedBookings({ bookings: [lateAfternoon], loss: loss('17:00'), now: NOW }),
    ).toEqual([]);
    expect(
      findAffectedBookings({ bookings: [lateAfternoon], loss: loss('16:59'), now: NOW }),
    ).toHaveLength(1);
  });

  it('judges the appointment, not its buffers', () => {
    const buffered = booking('b-buffered', '16:30', '17:00', {
      occupied: { start: at(MONDAY, '16:20'), end: at(MONDAY, '17:10') },
    });
    expect(findAffectedBookings({ bookings: [buffered], loss: loss('17:00'), now: NOW })).toEqual(
      [],
    );
  });

  it('merges the remaining time first, so a split that leaves no gap loses nothing', () => {
    const affected = findAffectedBookings({
      bookings: [booking('b-split', '11:45', '12:15')],
      loss: {
        kind: 'opening-hours',
        locationId: LOCATION,
        remaining: [between(MONDAY, '12:00', '13:00'), between(MONDAY, '08:00', '12:00')],
      },
      now: NOW,
    });
    expect(affected).toEqual([]);
  });

  it('leaves the bookings of other locations alone', () => {
    const elsewhere = booking('b-other', '16:30', '17:00', { locationId: OTHER_LOCATION });
    expect(findAffectedBookings({ bookings: [elsewhere], loss: loss('12:00'), now: NOW })).toEqual(
      [],
    );
  });

  it('skips what no longer matters: cancelled, completed, expired and bookings that are over', () => {
    const over = [
      booking('b-cancelled', '16:30', '17:00', {
        status: 'cancelled',
        cancelledAt: NOW,
        cancelledBy: 'manager',
      }),
      booking('b-completed', '16:30', '17:00', { status: 'completed' }),
      booking('b-noshow', '16:30', '17:00', { status: 'no_show' }),
      booking('b-expired', '16:30', '17:00', { status: 'expired' }),
    ];
    expect(findAffectedBookings({ bookings: over, loss: loss('12:00'), now: NOW })).toEqual([]);
    // A booking that already ended is history, even if nobody marked it.
    expect(
      findAffectedBookings({
        bookings: [booking('b-past', '16:30', '17:00')],
        loss: loss('12:00'),
        now: at(MONDAY, '17:00'),
      }),
    ).toEqual([]);
  });

  it('counts a running hold, and not one that has run out', () => {
    const running = booking('b-hold', '16:30', '17:00', {
      status: 'held',
      customer: null,
      holdExpiresAt: addMinutes(NOW, minutes(5)),
    });
    const ranOut = { ...running, id: toBookingId('b-ran-out'), holdExpiresAt: NOW };
    expect(
      idsOf(findAffectedBookings({ bookings: [running, ranOut], loss: loss('12:00'), now: NOW })),
    ).toEqual(['b-hold']);
  });

  it('orders bookings that start together by id', () => {
    const affected = findAffectedBookings({
      bookings: [booking('b-b', '16:30', '17:00'), booking('b-a', '16:30', '17:00')],
      loss: loss('12:00'),
      now: NOW,
    });
    expect(idsOf(affected)).toEqual(['b-a', 'b-b']);
  });
});

describe('when a resource loses time', () => {
  const anna = toBookableResourceId('anna');
  const buffered = (
    id: string,
    resource: string,
    from: string,
    to: string,
    occupiedFrom: string,
    occupiedTo: string,
  ) =>
    booking(id, from, to, {
      assignments: [
        unitOf(resource, {
          occupied: { start: at(MONDAY, occupiedFrom), end: at(MONDAY, occupiedTo) },
        }),
      ],
      occupied: { start: at(MONDAY, occupiedFrom), end: at(MONDAY, occupiedTo) },
    });

  it('lists the bookings on the resource that fall outside what remains', () => {
    const affected = findAffectedBookings({
      bookings: [
        buffered('b-1', 'anna', '10:00', '10:30', '10:00', '10:30'),
        buffered('b-2', 'anna', '14:00', '14:30', '14:00', '14:30'),
        buffered('b-3', 'ben', '14:00', '14:30', '14:00', '14:30'),
      ],
      loss: { kind: 'resource', resourceId: anna, remaining: [between(MONDAY, '08:00', '12:00')] },
      now: NOW,
    });

    expect(affected).toEqual([{ bookingId: 'b-2', reason: 'resource-unavailable' }]);
  });

  it('judges the whole occupied span, buffers included', () => {
    const edge = buffered('b-edge', 'anna', '11:30', '12:00', '11:20', '12:10');
    const remaining = [between(MONDAY, '08:00', '12:00')];
    expect(
      findAffectedBookings({
        bookings: [edge],
        loss: { kind: 'resource', resourceId: anna, remaining },
        now: NOW,
      }),
    ).toHaveLength(1);
    expect(
      findAffectedBookings({
        bookings: [edge],
        loss: {
          kind: 'resource',
          resourceId: anna,
          remaining: [between(MONDAY, '08:00', '12:10')],
        },
        now: NOW,
      }),
    ).toEqual([]);
  });

  it('finds every booking when the resource is blocked for the whole time', () => {
    const affected = findAffectedBookings({
      bookings: [booking('b-1', '10:00', '10:30'), booking('b-2', '11:00', '11:30')],
      loss: { kind: 'resource', resourceId: anna, remaining: [] },
      now: NOW,
    });
    expect(idsOf(affected)).toEqual(['b-1', 'b-2']);
  });

  it('ignores a booking whose unit for this resource is still open', () => {
    const open = booking('b-open', '10:00', '10:30', { assignments: [unitOf(null)] });
    expect(
      findAffectedBookings({
        bookings: [open],
        loss: { kind: 'resource', resourceId: anna, remaining: [] },
        now: NOW,
      }),
    ).toEqual([]);
  });
});

describe('when a resource gets fewer places', () => {
  const room = toBookableResourceId('room');
  const inRoom = (id: string, from: string, to: string) =>
    booking(id, from, to, {
      assignments: [unitOf('room', { resourceType: 'room', occupied: between(MONDAY, from, to) })],
    });
  const loss = (places: number) => ({ kind: 'places' as const, resourceId: room, places });

  it('reports every booking that shares the room beyond its places, and none that fits', () => {
    const bookings = [
      inRoom('b-a', '10:00', '11:00'),
      inRoom('b-b', '10:30', '11:30'),
      inRoom('b-c', '14:00', '15:00'),
    ];

    expect(findAffectedBookings({ bookings, loss: loss(1), now: NOW })).toEqual([
      { bookingId: 'b-a', reason: 'over-capacity' },
      { bookingId: 'b-b', reason: 'over-capacity' },
    ]);
    expect(findAffectedBookings({ bookings, loss: loss(2), now: NOW })).toEqual([]);
  });

  it('does not stack bookings that only touch', () => {
    const bookings = [inRoom('b-a', '10:00', '11:00'), inRoom('b-b', '11:00', '12:00')];

    expect(findAffectedBookings({ bookings, loss: loss(1), now: NOW })).toEqual([]);
  });
});
