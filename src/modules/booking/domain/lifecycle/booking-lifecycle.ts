import type { ConflictAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { BOOKING_ERROR_CODES as CODES, bookingConflict } from '../errors/booking-errors';
import { hasOpenUnits, updatedBooking } from '../models/booking';
import { checkCancellation, checkRescheduling } from '../policies/change-policy';

import { requireAction } from './booking-actions';
import { assignmentsForSlot, slotMatchesService } from './slot-assignments';

import type { BookableService, ChangeActor } from '../models/bookable-service';
import type { Booking } from '../models/booking';
import type { PlannedSlot } from '../scheduling/scheduling-types';
import type { Instant } from '../time/instant';

/**
 * The rest of a booking's life, after it was reserved: cancelling, moving and carrying out. Pure
 * functions, like the ones in `booking-hold.ts`; the reference instant is always an argument.
 */

export interface CancelInput {
  readonly booking: Booking;
  readonly service: BookableService;
  readonly actor: ChangeActor;
  readonly now: Instant;
}

/** Cancels a hold or a booking, if the service's policy lets this actor. */
export function cancelBooking(input: CancelInput): AppResult<Booking, ConflictAppError> {
  const { booking, service, actor, now } = input;
  const allowed = requireAction(booking, 'cancel');
  if (allowed.isErr()) {
    return err(allowed.error);
  }
  const permitted = checkCancellation(service, booking, { actor, now });
  if (permitted.isErr()) {
    return err(permitted.error);
  }
  return ok(
    updatedBooking(booking, now, {
      status: 'cancelled',
      cancelledAt: now,
      cancelledBy: actor,
      holdExpiresAt: null,
    }),
  );
}

/** Whether the appointment has begun: from then on it is carried out, and who serves it stays. */
export function hasStarted(booking: Booking, now: Instant): boolean {
  return now >= booking.start;
}

/**
 * Records that the appointment took place. Only after it began, and only when someone served it: a
 * booking that still waits for an employee cannot have been carried out. (Proposed rule.)
 */
export function completeBooking(
  booking: Booking,
  now: Instant,
): AppResult<Booking, ConflictAppError> {
  const allowed = requireAction(booking, 'complete');
  if (allowed.isErr()) {
    return err(allowed.error);
  }
  if (!hasStarted(booking, now)) {
    return err(bookingConflict(CODES.bookingNotStarted, 'The appointment has not begun.'));
  }
  if (hasOpenUnits(booking)) {
    return err(bookingConflict(CODES.assignmentIncomplete, 'An employee is still to be assigned.'));
  }
  return ok(updatedBooking(booking, now, { status: 'completed' }));
}

/** Records that the customer did not come. Only after the start. */
export function markNoShow(booking: Booking, now: Instant): AppResult<Booking, ConflictAppError> {
  const allowed = requireAction(booking, 'mark-no-show');
  if (allowed.isErr()) {
    return err(allowed.error);
  }
  if (!hasStarted(booking, now)) {
    return err(bookingConflict(CODES.bookingNotStarted, 'The appointment has not begun.'));
  }
  return ok(updatedBooking(booking, now, { status: 'no_show' }));
}

export interface RescheduleInput {
  readonly booking: Booking;
  readonly service: BookableService;
  /** A slot of the scheduling engine for this service, assessed without this booking blocking it. */
  readonly slot: PlannedSlot;
  readonly actor: ChangeActor;
  readonly now: Instant;
}

/**
 * Moves a confirmed booking onto a slot the engine has already approved. Status, service and
 * location stay: moving to another service or location is a cancellation and a new booking. The
 * policy is checked here, so a move cannot bypass it. The assignments are those the slot gives:
 * for a service assigned at booking time the engine's choice, for one assigned later the employee
 * units become open again, because the old assignee was approved for the old time (proposed rule,
 * to be confirmed with P11).
 */
export function rescheduleBooking(input: RescheduleInput): AppResult<Booking, ConflictAppError> {
  const { booking, service, slot, actor, now } = input;
  const allowed = requireAction(booking, 'reschedule');
  if (allowed.isErr()) {
    return err(allowed.error);
  }
  const permitted = checkRescheduling(service, booking, { actor, now });
  if (permitted.isErr()) {
    return err(permitted.error);
  }
  if (!slotMatchesService(service, slot)) {
    return err(bookingConflict(CODES.slotUnavailable, 'The slot does not fit the service.'));
  }
  return ok(
    updatedBooking(booking, now, {
      start: slot.start,
      end: slot.end,
      occupied: slot.occupied,
      assignments: assignmentsForSlot(service, slot),
      rescheduleCount: booking.rescheduleCount + (actor === 'customer' ? 1 : 0),
    }),
  );
}
