import type { ConflictAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import {
  cancellationDeadlinePassed,
  cancellationNotAllowed,
  reschedulingDeadlinePassed,
  reschedulingNotAllowed,
} from '../errors/booking-errors';
import { MS_PER_MINUTE } from '../time/time-of-day';

import type { BookableService, ChangeActor, ChangePolicy } from '../models/bookable-service';
import type { Booking } from '../models/booking';

/**
 * How often a customer may move one booking. Staff are not limited: the cap
 * exists so a citizen cannot hold a popular slot indefinitely by shuffling it.
 */
export const MAX_CUSTOMER_RESCHEDULES = 3;

function withinDeadline(policy: ChangePolicy, booking: Booking, now: Date): boolean {
  return now.getTime() <= booking.start.getTime() - policy.deadlineMinutes * MS_PER_MINUTE;
}

function permits(policy: ChangePolicy, actor: ChangeActor): boolean {
  return policy.isAllowed && policy.allowedActors.includes(actor);
}

/**
 * Whether `actor` may cancel the booking now. A hold is not a commitment yet,
 * so abandoning one is always allowed; a confirmed booking follows the
 * service's policy, whose deadline binds customers only.
 */
export function checkCancellation(
  service: BookableService,
  booking: Booking,
  actor: ChangeActor,
  now: Date,
): AppResult<true, ConflictAppError> {
  if (booking.status === 'held') {
    return ok(true);
  }
  const policy = service.cancellation;
  if (!permits(policy, actor)) {
    return err(cancellationNotAllowed());
  }
  if (actor === 'customer' && !withinDeadline(policy, booking, now)) {
    return err(cancellationDeadlinePassed());
  }
  return ok(true);
}

/** Whether `actor` may move the booking to another time now. */
export function checkRescheduling(
  service: BookableService,
  booking: Booking,
  actor: ChangeActor,
  now: Date,
): AppResult<true, ConflictAppError> {
  const policy = service.rescheduling;
  if (!permits(policy, actor)) {
    return err(reschedulingNotAllowed());
  }
  if (actor === 'customer') {
    if (booking.rescheduleCount >= MAX_CUSTOMER_RESCHEDULES) {
      return err(reschedulingNotAllowed());
    }
    if (!withinDeadline(policy, booking, now)) {
      return err(reschedulingDeadlinePassed());
    }
  }
  return ok(true);
}
