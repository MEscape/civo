import { heldResourceIds } from '../models/booking';

import type { Booking } from '../models/booking';

/** What can be wrong with a booking as a whole. */
export type InvariantViolation =
  | 'appointment-not-forward'
  | 'occupied-does-not-cover-appointment'
  | 'unit-span-outside-booking'
  | 'hold-without-expiry'
  | 'expiry-outside-hold'
  | 'customer-missing'
  | 'cancellation-incomplete'
  | 'cancellation-unexpected'
  | 'open-unit-not-employee'
  | 'resource-held-twice'
  | 'negative-reschedule-count';

const STATUSES_WITH_CUSTOMER = ['confirmed', 'completed', 'no_show'] as const;

/**
 * The invariants a booking always keeps, whatever produced it. The lifecycle functions preserve
 * them; this lists the ones a booking read from storage or built by hand breaks, so an adapter can
 * refuse a corrupt row instead of acting on it.
 */
export function findInvariantViolations(booking: Booking): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const check = (isBroken: boolean, violation: InvariantViolation) => {
    if (isBroken) {
      violations.push(violation);
    }
  };

  check(booking.end <= booking.start, 'appointment-not-forward');
  check(
    booking.occupied.start > booking.start || booking.occupied.end < booking.end,
    'occupied-does-not-cover-appointment',
  );
  check(
    booking.assignments.some(
      (unit) =>
        unit.occupied.start > booking.start ||
        unit.occupied.end < booking.end ||
        unit.occupied.start < booking.occupied.start ||
        unit.occupied.end > booking.occupied.end,
    ),
    'unit-span-outside-booking',
  );
  check(booking.status === 'held' && booking.holdExpiresAt === null, 'hold-without-expiry');
  check(booking.status !== 'held' && booking.holdExpiresAt !== null, 'expiry-outside-hold');
  check(
    booking.customer === null && STATUSES_WITH_CUSTOMER.some((status) => status === booking.status),
    'customer-missing',
  );
  const isCancelled = booking.status === 'cancelled';
  check(
    isCancelled && (booking.cancelledAt === null || booking.cancelledBy === null),
    'cancellation-incomplete',
  );
  check(
    !isCancelled && (booking.cancelledAt !== null || booking.cancelledBy !== null),
    'cancellation-unexpected',
  );
  check(
    booking.assignments.some(
      (unit) => unit.resourceId === null && unit.resourceType !== 'employee',
    ),
    'open-unit-not-employee',
  );
  const held = heldResourceIds(booking);
  check(new Set(held).size !== held.length, 'resource-held-twice');
  check(booking.rescheduleCount < 0, 'negative-reschedule-count');
  return violations;
}
