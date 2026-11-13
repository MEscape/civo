import { describe, expect, it } from 'vitest';

import { scheduleOf } from '@modules/booking/application/services/scheduling-context';
import { toBookingId, toBookingLocationId } from '@modules/booking/domain/models/ids';
import { CLOSED_DAY } from '@modules/booking/domain/scheduling/weekly-hours';

import { MONDAY, employee, makeBooking, unitOf } from '../support/booking-fixtures';
import { BERLIN, between, day } from '../support/time-fixtures';

const location = {
  id: toBookingLocationId('loc-west'),
  name: 'Rathaus West',
  address: null,
  zone: BERLIN,
  isActive: true,
  openingHours: {
    weekly: {
      1: CLOSED_DAY,
      2: CLOSED_DAY,
      3: CLOSED_DAY,
      4: CLOSED_DAY,
      5: CLOSED_DAY,
      6: CLOSED_DAY,
      7: CLOSED_DAY,
    },
    exceptions: [],
  },
};
const window = { from: day(MONDAY), to: day(MONDAY) };

/** Two bookings of the room, 10:00-11:00 and 10:30-11:30. */
const blocking = [
  makeBooking({
    id: toBookingId('b1'),
    assignments: [
      unitOf('room', { resourceType: 'room', occupied: between(MONDAY, '10:00', '11:00') }),
    ],
  }),
  makeBooking({
    id: toBookingId('b2'),
    assignments: [
      unitOf('room', { resourceType: 'room', occupied: between(MONDAY, '10:30', '11:30') }),
    ],
  }),
];

describe('what holds a resource', () => {
  it('is every booking of a room with one place', () => {
    const room = employee('room', { type: 'room', capacity: 1 });

    expect(scheduleOf(room, { location, window, blocking }).busy).toEqual([
      between(MONDAY, '10:00', '11:30'),
    ]);
  });

  it('is only where every place is taken for a room with two', () => {
    const room = employee('room', { type: 'room', capacity: 2 });

    expect(scheduleOf(room, { location, window, blocking }).busy).toEqual([
      between(MONDAY, '10:30', '11:00'),
    ]);
  });

  it('treats an employee as one place whatever capacity is stored', () => {
    const person = employee('room', { capacity: 4 });

    expect(scheduleOf(person, { location, window, blocking }).busy).toEqual([
      between(MONDAY, '10:00', '11:30'),
    ]);
  });
});
