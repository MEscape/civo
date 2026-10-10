import type { ConflictAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import {
  bookingExpired,
  bookingNotStarted,
  invalidStateTransition,
} from '../errors/booking-errors';
import { bookingSessionKey } from '../models/booking';

import type { ChangeActor } from '../models/bookable-service';
import type { Booking, BookingStatus } from '../models/booking';
import type { BookingCustomer } from '../models/booking-customer';
import type { PlannedSlot } from '../scheduling/scheduling-types';

/**
 * The booking state machine, as pure functions: each takes a booking and the
 * time, and returns the changed booking or the reason it cannot change. They
 * touch no storage; the application layer persists the result, and the
 * database refuses a stale write, so two concurrent transitions cannot both
 * succeed.
 *
 *   held ──confirm──▶ confirmed ──complete──▶ completed
 *     │                   │  └────no-show───▶ no_show
 *     ├──expire──▶ expired│
 *     └──cancel──▶ cancelled ◀──cancel──┘     (reschedule keeps `confirmed`)
 */
export const BOOKING_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  held: ['confirmed', 'cancelled', 'expired'],
  confirmed: ['cancelled', 'completed', 'no_show'],
  cancelled: [],
  completed: [],
  no_show: [],
  expired: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

function move(
  booking: Booking,
  to: BookingStatus,
  event: string,
  now: Date,
  changes: Partial<Booking> = {},
): AppResult<Booking, ConflictAppError> {
  if (!canTransition(booking.status, to)) {
    return err(invalidStateTransition(booking.status, event));
  }
  return ok({ ...booking, ...changes, status: to, updatedAt: now });
}

/** Whether a hold has run out. Judged on the clock so it holds even before anything marks it `expired`. */
export function isHoldExpired(booking: Booking, now: Date): boolean {
  return (
    booking.status === 'held' &&
    (booking.holdExpiresAt === null || booking.holdExpiresAt.getTime() <= now.getTime())
  );
}

/** Turns a hold into a booking once the visitor's details are in. */
export function confirmBooking(
  booking: Booking,
  customer: BookingCustomer,
  now: Date,
): AppResult<Booking, ConflictAppError> {
  if (booking.status !== 'held') {
    return err(invalidStateTransition(booking.status, 'confirm'));
  }
  if (isHoldExpired(booking, now)) {
    return err(bookingExpired());
  }
  return move(booking, 'confirmed', 'confirm', now, { customer, holdExpiresAt: null });
}

/** Marks a hold that ran out; idempotent callers check `isHoldExpired` first. */
export function expireHold(booking: Booking, now: Date): AppResult<Booking, ConflictAppError> {
  return move(booking, 'expired', 'expire', now);
}

export function cancelBooking(
  booking: Booking,
  actor: ChangeActor,
  now: Date,
): AppResult<Booking, ConflictAppError> {
  return move(booking, 'cancelled', 'cancel', now, {
    cancelledAt: now,
    cancelledBy: actor,
    holdExpiresAt: null,
  });
}

function afterStart(booking: Booking, now: Date): boolean {
  return now.getTime() >= booking.start.getTime();
}

/** Staff record that the appointment took place. Only after it began. */
export function completeBooking(booking: Booking, now: Date): AppResult<Booking, ConflictAppError> {
  if (booking.status === 'confirmed' && !afterStart(booking, now)) {
    return err(bookingNotStarted());
  }
  return move(booking, 'completed', 'complete', now);
}

/** Staff record that the customer did not come. Only after the start. */
export function markNoShow(booking: Booking, now: Date): AppResult<Booking, ConflictAppError> {
  if (booking.status === 'confirmed' && !afterStart(booking, now)) {
    return err(bookingNotStarted());
  }
  return move(booking, 'no_show', 'no-show', now);
}

/**
 * Moves a confirmed booking onto a slot the engine has already approved. The
 * status stays `confirmed`: the booking never stops existing, so the customer
 * keeps their reference and there is no moment when the old time is released
 * and the new one is not yet held.
 */
export function rescheduleBooking(
  booking: Booking,
  slot: PlannedSlot,
  now: Date,
): AppResult<Booking, ConflictAppError> {
  if (booking.status !== 'confirmed') {
    return err(invalidStateTransition(booking.status, 'reschedule'));
  }
  return ok({
    ...booking,
    start: new Date(slot.start),
    end: new Date(slot.end),
    occupiedStart: new Date(slot.occupied.start),
    occupiedEnd: new Date(slot.occupied.end),
    resourceIds: slot.resourceIds,
    sessionKey: bookingSessionKey(slot.sharedSessionKey, booking.reference),
    sessionCapacity: slot.sessionCapacity,
    rescheduleCount: booking.rescheduleCount + 1,
    updatedAt: now,
  });
}
