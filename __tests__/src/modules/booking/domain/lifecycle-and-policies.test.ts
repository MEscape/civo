import { describe, expect, it } from 'vitest';

import {
  canTransition,
  cancelBooking,
  completeBooking,
  confirmBooking,
  expireHold,
  isHoldExpired,
  markNoShow,
  rescheduleBooking,
  BOOKING_TRANSITIONS,
} from '@modules/booking/domain/lifecycle/booking-lifecycle';
import { BOOKING_STATUSES } from '@modules/booking/domain/models/booking';
import type { Booking } from '@modules/booking/domain/models/booking';
import { createBookingCustomer } from '@modules/booking/domain/models/booking-customer';
import {
  MAX_CUSTOMER_RESCHEDULES,
  checkCancellation,
  checkRescheduling,
} from '@modules/booking/domain/policies/change-policy';
import { assessSlot } from '@modules/booking/domain/scheduling/slot-assessment';

import { NOW, at, indexFor, makeBooking, makeService } from '../support/fixtures';

const MONDAY = '2027-01-11';
const HOUR = 3_600_000;

function customer() {
  const service = makeService();
  const result = createBookingCustomer(service, { email: ' Anna@Example.com ' });
  if (result.isErr()) {
    throw new Error('customer');
  }
  return result.value;
}

function held(overrides: Partial<Booking> = {}): Booking {
  return {
    ...makeBooking({ start: at(MONDAY, '10:00'), resources: ['emp-1'], status: 'held' }),
    ...overrides,
  };
}

function confirmed(overrides: Partial<Booking> = {}): Booking {
  return {
    ...makeBooking({ start: at(MONDAY, '10:00'), resources: ['emp-1'] }),
    ...overrides,
  };
}

describe('state machine', () => {
  it('only allows the documented transitions', () => {
    for (const from of BOOKING_STATUSES) {
      for (const to of BOOKING_STATUSES) {
        expect(canTransition(from, to)).toBe(BOOKING_TRANSITIONS[from].includes(to));
      }
    }
    expect(canTransition('cancelled', 'confirmed')).toBe(false);
    expect(canTransition('expired', 'confirmed')).toBe(false);
    expect(canTransition('completed', 'cancelled')).toBe(false);
  });

  it('confirms a live hold and stores the customer', () => {
    const result = confirmBooking(held(), customer(), NOW);
    expect(result.isOk()).toBe(true);
    const booking = result._unsafeUnwrap();
    expect(booking.status).toBe('confirmed');
    expect(booking.holdExpiresAt).toBeNull();
    expect(booking.customer?.email).toBe('anna@example.com');
    expect(booking.updatedAt).toBe(NOW);
  });

  it('refuses to confirm an expired hold, even before anything marked it expired', () => {
    const stale = held({ holdExpiresAt: new Date(NOW.getTime() - 1) });
    expect(isHoldExpired(stale, NOW)).toBe(true);
    const result = confirmBooking(stale, customer(), NOW);
    expect(result._unsafeUnwrapErr().code).toBe('booking.expired');
  });

  it('refuses to confirm anything but a hold', () => {
    const result = confirmBooking(confirmed(), customer(), NOW);
    expect(result._unsafeUnwrapErr().code).toBe('booking.invalid_state_transition');
  });

  it('expires only holds', () => {
    expect(expireHold(held(), NOW)._unsafeUnwrap().status).toBe('expired');
    expect(expireHold(confirmed(), NOW).isErr()).toBe(true);
  });

  it('cancels holds and confirmed bookings but nothing that has ended', () => {
    expect(cancelBooking(held(), 'customer', NOW)._unsafeUnwrap()).toMatchObject({
      status: 'cancelled',
      cancelledBy: 'customer',
      cancelledAt: NOW,
    });
    expect(cancelBooking(confirmed(), 'staff', NOW)._unsafeUnwrap().cancelledBy).toBe('staff');
    for (const status of ['cancelled', 'completed', 'no_show', 'expired'] as const) {
      expect(cancelBooking(confirmed({ status }), 'staff', NOW).isErr()).toBe(true);
    }
  });

  it('completes and marks no-shows only once the appointment began', () => {
    const upcoming = confirmed();
    expect(completeBooking(upcoming, NOW)._unsafeUnwrapErr().code).toBe('booking.not_started');
    expect(markNoShow(upcoming, NOW)._unsafeUnwrapErr().code).toBe('booking.not_started');
    const after = new Date(upcoming.start.getTime() + 1);
    expect(completeBooking(upcoming, after)._unsafeUnwrap().status).toBe('completed');
    expect(markNoShow(upcoming, after)._unsafeUnwrap().status).toBe('no_show');
  });

  it('does not complete a hold', () => {
    const after = new Date(at(MONDAY, '12:00'));
    expect(completeBooking(held(), after)._unsafeUnwrapErr().code).toBe(
      'booking.invalid_state_transition',
    );
  });

  it('does not change its input', () => {
    const original = held();
    const snapshot = JSON.stringify(original);
    confirmBooking(original, customer(), NOW);
    cancelBooking(original, 'staff', NOW);
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});

describe('rescheduling', () => {
  it('moves a confirmed booking onto an approved slot and keeps its identity', () => {
    const booking = confirmed({ id: confirmed().id });
    const index = indexFor({ bookings: [booking], ignoreBookingId: booking.id });
    const assessment = assessSlot(index, at(MONDAY, '14:00'), 1);
    expect(assessment.kind).toBe('planned');
    if (assessment.kind !== 'planned') {
      return;
    }
    const moved = rescheduleBooking(booking, assessment.slot, NOW)._unsafeUnwrap();
    expect(moved.id).toBe(booking.id);
    expect(moved.reference).toBe(booking.reference);
    expect(moved.status).toBe('confirmed');
    expect(moved.start.getTime()).toBe(at(MONDAY, '14:00'));
    expect(moved.rescheduleCount).toBe(1);
  });

  it('refuses to reschedule anything that is not confirmed', () => {
    const index = indexFor();
    const assessment = assessSlot(index, at(MONDAY, '14:00'), 1);
    if (assessment.kind !== 'planned') {
      throw new Error('expected a slot');
    }
    expect(rescheduleBooking(held(), assessment.slot, NOW).isErr()).toBe(true);
    expect(
      rescheduleBooking(confirmed({ status: 'cancelled' }), assessment.slot, NOW).isErr(),
    ).toBe(true);
  });
});

describe('change policy', () => {
  const booking = confirmed();

  it('lets a customer cancel before the deadline and not after', () => {
    const service = makeService();
    const early = new Date(booking.start.getTime() - 25 * HOUR);
    const late = new Date(booking.start.getTime() - 23 * HOUR);
    expect(checkCancellation(service, booking, 'customer', early).isOk()).toBe(true);
    expect(checkCancellation(service, booking, 'customer', late)._unsafeUnwrapErr().code).toBe(
      'booking.cancellation_deadline_passed',
    );
  });

  it('does not bind staff by the customer deadline', () => {
    const late = new Date(booking.start.getTime() - 5 * 60_000);
    expect(checkCancellation(makeService(), booking, 'staff', late).isOk()).toBe(true);
  });

  it('honours a service that forbids cancellation', () => {
    const service = makeService({
      cancellation: { isAllowed: false, deadlineMinutes: 0, allowedActors: ['customer', 'staff'] },
    });
    expect(checkCancellation(service, booking, 'staff', NOW)._unsafeUnwrapErr().code).toBe(
      'booking.cancellation_not_allowed',
    );
  });

  it('honours the allowed actors', () => {
    const service = makeService({
      cancellation: { isAllowed: true, deadlineMinutes: 0, allowedActors: ['staff'] },
    });
    expect(checkCancellation(service, booking, 'customer', NOW).isErr()).toBe(true);
    expect(checkCancellation(service, booking, 'staff', NOW).isOk()).toBe(true);
  });

  it('always lets a hold be abandoned', () => {
    const service = makeService({
      cancellation: { isAllowed: false, deadlineMinutes: 0, allowedActors: [] },
    });
    expect(checkCancellation(service, held(), 'customer', NOW).isOk()).toBe(true);
  });

  it('applies the rescheduling deadline to customers', () => {
    const service = makeService();
    const late = new Date(booking.start.getTime() - HOUR);
    expect(checkRescheduling(service, booking, 'customer', NOW).isOk()).toBe(true);
    expect(checkRescheduling(service, booking, 'customer', late)._unsafeUnwrapErr().code).toBe(
      'booking.rescheduling_deadline_passed',
    );
    expect(checkRescheduling(service, booking, 'staff', late).isOk()).toBe(true);
  });

  it('caps how often a customer may move a booking, but not staff', () => {
    const worn = confirmed({ rescheduleCount: MAX_CUSTOMER_RESCHEDULES });
    expect(checkRescheduling(makeService(), worn, 'customer', NOW).isErr()).toBe(true);
    expect(checkRescheduling(makeService(), worn, 'staff', NOW).isOk()).toBe(true);
  });
});
