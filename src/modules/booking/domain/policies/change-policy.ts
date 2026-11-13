import type { ConflictAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { BOOKING_ERROR_CODES as CODES, bookingConflict } from '../errors/booking-errors';
import { subtractMinutes } from '../time/instant';

import type { BookableService, ChangeActor, ChangePolicy } from '../models/bookable-service';
import type { Booking } from '../models/booking';
import type { Instant } from '../time/instant';

/**
 * How often a customer may move one booking. Employees and managers are not limited: the cap
 * exists so a citizen cannot hold a popular slot indefinitely by shuffling it.
 */
export const MAX_CUSTOMER_RESCHEDULES = 3;

/** Who tries to change a booking, and when. The reference instant is always passed in. */
export interface ChangeAttempt {
  readonly actor: ChangeActor;
  readonly now: Instant;
}

/**
 * Why a change is refused, as data the caller can explain:
 *  - `disabled`: the service does not allow it at all;
 *  - `actor-not-allowed`: it does, but not to this actor;
 *  - `deadline-passed`: a customer is too late (the deadline binds customers only);
 *  - `limit-reached`: a customer has moved the booking as often as allowed.
 */
export type ChangeDenial = 'disabled' | 'actor-not-allowed' | 'deadline-passed' | 'limit-reached';

function isWithinDeadline(policy: ChangePolicy, booking: Booking, now: Instant): boolean {
  return now <= subtractMinutes(booking.start, policy.deadlineMinutes);
}

function denialOf(
  policy: ChangePolicy,
  booking: Booking,
  { actor, now }: ChangeAttempt,
): ChangeDenial | null {
  if (!policy.isAllowed) {
    return 'disabled';
  }
  if (!policy.allowedActors.includes(actor)) {
    return 'actor-not-allowed';
  }
  return actor === 'customer' && !isWithinDeadline(policy, booking, now) ? 'deadline-passed' : null;
}

/**
 * Whether `attempt.actor` may cancel the booking now; `null` when allowed. A hold is not a
 * commitment, so abandoning one is always allowed; a confirmed booking follows the service's policy.
 */
export function evaluateCancellation(
  service: BookableService,
  booking: Booking,
  attempt: ChangeAttempt,
): ChangeDenial | null {
  return booking.status === 'held' ? null : denialOf(service.cancellation, booking, attempt);
}

/** Whether `attempt.actor` may move the booking to another time now; `null` when allowed. */
export function evaluateRescheduling(
  service: BookableService,
  booking: Booking,
  attempt: ChangeAttempt,
): ChangeDenial | null {
  const denial = denialOf(service.rescheduling, booking, attempt);
  if (denial !== null) {
    return denial;
  }
  return attempt.actor === 'customer' && booking.rescheduleCount >= MAX_CUSTOMER_RESCHEDULES
    ? 'limit-reached'
    : null;
}

export function checkCancellation(
  service: BookableService,
  booking: Booking,
  attempt: ChangeAttempt,
): AppResult<true, ConflictAppError> {
  const denial = evaluateCancellation(service, booking, attempt);
  if (denial === null) {
    return ok(true);
  }
  return err(
    denial === 'deadline-passed'
      ? bookingConflict(CODES.cancellationDeadlinePassed, 'The cancellation deadline has passed.')
      : bookingConflict(CODES.cancellationNotAllowed, 'This booking cannot be cancelled by you.'),
  );
}

export function checkRescheduling(
  service: BookableService,
  booking: Booking,
  attempt: ChangeAttempt,
): AppResult<true, ConflictAppError> {
  const denial = evaluateRescheduling(service, booking, attempt);
  if (denial === null) {
    return ok(true);
  }
  switch (denial) {
    case 'deadline-passed':
      return err(
        bookingConflict(CODES.reschedulingDeadlinePassed, 'The change deadline has passed.'),
      );
    case 'limit-reached':
      return err(
        bookingConflict(
          CODES.reschedulingLimitReached,
          'The booking was moved as often as allowed.',
        ),
      );
    case 'disabled':
    case 'actor-not-allowed':
      return err(
        bookingConflict(CODES.reschedulingNotAllowed, 'This booking cannot be moved by you.'),
      );
  }
}
