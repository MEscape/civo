import { describe, expect, it } from 'vitest';

import { findInvariantViolations } from '@modules/booking/domain/lifecycle/booking-invariants';
import type { Booking } from '@modules/booking/domain/models/booking';
import { addMinutes } from '@modules/booking/domain/time/instant';

import { NOW, makeBooking, minutes, unitOf } from '../support/booking-fixtures';

describe('invariants of a booking', () => {
  function violationsOf(overrides: Partial<Booking>) {
    return findInvariantViolations(makeBooking(overrides));
  }

  it('finds none in a sound booking', () => {
    expect(violationsOf({})).toEqual([]);
  });

  it('names each way a booking can be corrupt', () => {
    const booking = makeBooking();
    expect(violationsOf({ end: booking.start })).toContain('appointment-not-forward');
    expect(
      violationsOf({
        occupied: { ...booking.occupied, start: addMinutes(booking.start, minutes(5)) },
      }),
    ).toContain('occupied-does-not-cover-appointment');
    expect(violationsOf({ status: 'held', customer: null, holdExpiresAt: null })).toContain(
      'hold-without-expiry',
    );
    expect(violationsOf({ holdExpiresAt: NOW })).toContain('expiry-outside-hold');
    expect(violationsOf({ customer: null })).toContain('customer-missing');
    expect(violationsOf({ status: 'cancelled' })).toContain('cancellation-incomplete');
    expect(violationsOf({ cancelledAt: NOW, cancelledBy: 'customer' })).toContain(
      'cancellation-unexpected',
    );
    expect(violationsOf({ assignments: [unitOf(null, { resourceType: 'room' })] })).toContain(
      'open-unit-not-employee',
    );
    expect(violationsOf({ assignments: [unitOf('anna'), unitOf('anna')] })).toContain(
      'resource-held-twice',
    );
    expect(violationsOf({ rescheduleCount: -1 })).toContain('negative-reschedule-count');
  });

  it('allows a cancelled booking and an open employee unit', () => {
    expect(
      violationsOf({
        status: 'cancelled',
        cancelledAt: NOW,
        cancelledBy: 'manager',
        customer: null,
      }),
    ).toEqual([]);
    expect(violationsOf({ assignments: [unitOf(null)] })).toEqual([]);
  });
});
