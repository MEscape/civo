import type { ConflictAppError, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import {
  BOOKING_ERROR_CODES as CODES,
  BOOKING_VALIDATION_CODES,
  bookingConflict,
  createBookingErrorBag,
} from '../errors/booking-errors';
import { hasOpenUnits, updatedBooking } from '../models/booking';
import { evaluateBookable, missingInformation } from '../policies/service-policy';
import { addMinutes } from '../time/instant';

import { requireAction } from './booking-actions';
import { assignmentsForSlot, slotMatchesService } from './slot-assignments';

import type { BookableService } from '../models/bookable-service';
import type { Booking, BookingCustomer } from '../models/booking';
import type { BookingId, BookingLocationId } from '../models/ids';
import type { BookingChannel } from '../policies/service-policy';
import type { PlannedSlot } from '../scheduling/scheduling-types';
import type { Instant } from '../time/instant';
import type { Minutes } from '../time/minutes';

/**
 * The first part of a booking's life, from the reservation to the confirmation: pure functions that
 * take the booking and the time and return the changed booking or the reason it cannot change, as a
 * typed error with a stable code. They touch no storage; the application layer persists the result,
 * and the database refuses a stale write, so two concurrent transitions cannot both succeed.
 */

/** Whether a hold has run out. Judged on the clock, so it holds even before anything marks it `expired`. */
export function isHoldExpired(booking: Booking, now: Instant): boolean {
  return (
    booking.status === 'held' && (booking.holdExpiresAt === null || booking.holdExpiresAt <= now)
  );
}

export interface HoldInput {
  readonly id: BookingId;
  readonly service: BookableService;
  readonly locationId: BookingLocationId;
  /** Who is booking: a visitor online, or a manager. */
  readonly channel: BookingChannel;
  /** A slot of the scheduling engine for this service. */
  readonly slot: PlannedSlot;
  readonly now: Instant;
  /** How long the slot stays reserved while the visitor fills in the form. */
  readonly holdMinutes: Minutes;
}

/** Reserves a slot for a visitor who has not entered their details yet. */
export function createHold(input: HoldInput): AppResult<Booking, ConflictAppError> {
  const { id, service, locationId, channel, slot, now, holdMinutes } = input;
  const denial = evaluateBookable(service, locationId, channel);
  if (denial === 'service-inactive') {
    return err(bookingConflict(CODES.serviceInactive, 'The service cannot be booked.'));
  }
  if (denial === 'location-not-offered') {
    return err(bookingConflict(CODES.locationNotOffered, 'The service is not offered here.'));
  }
  if (!slotMatchesService(service, slot)) {
    return err(bookingConflict(CODES.slotUnavailable, 'The slot does not fit the service.'));
  }
  return ok({
    id,
    serviceId: service.id,
    locationId,
    status: 'held',
    start: slot.start,
    end: slot.end,
    occupied: slot.occupied,
    assignments: assignmentsForSlot(service, slot),
    customer: null,
    holdExpiresAt: addMinutes(now, holdMinutes),
    rescheduleCount: 0,
    cancelledAt: null,
    cancelledBy: null,
    createdAt: now,
    updatedAt: now,
  });
}

export interface ConfirmInput {
  readonly booking: Booking;
  readonly service: BookableService;
  readonly customer: BookingCustomer;
  readonly now: Instant;
}

/**
 * Turns a hold into a booking once the visitor's details are in. Refused for a hold that ran out,
 * for required details that are blank (one field error each), and, for a service whose employees are
 * assigned at booking time, while a unit is still open.
 */
export function confirmBooking(
  input: ConfirmInput,
): AppResult<Booking, ConflictAppError | ValidationAppError> {
  const { booking, service, customer, now } = input;
  const allowed = requireAction(booking, 'confirm');
  if (allowed.isErr()) {
    return err(allowed.error);
  }
  if (isHoldExpired(booking, now)) {
    return err(bookingConflict(CODES.bookingExpired, 'The reservation has expired.'));
  }
  const bag = createBookingErrorBag();
  for (const field of missingInformation(service, customer)) {
    bag.add(`customer.${field}`, BOOKING_VALIDATION_CODES.fieldRequired);
  }
  if (bag.hasErrors) {
    return err(bag.toError());
  }
  if (service.assignmentMode === 'automatic' && hasOpenUnits(booking)) {
    return err(bookingConflict(CODES.assignmentIncomplete, 'An employee is still to be assigned.'));
  }
  return ok(updatedBooking(booking, now, { status: 'confirmed', customer, holdExpiresAt: null }));
}

/** Marks a hold that ran out. Refused while the hold is still running. */
export function expireHold(booking: Booking, now: Instant): AppResult<Booking, ConflictAppError> {
  const allowed = requireAction(booking, 'expire');
  if (allowed.isErr()) {
    return err(allowed.error);
  }
  if (!isHoldExpired(booking, now)) {
    return err(bookingConflict(CODES.holdNotExpired, 'The reservation is still running.'));
  }
  return ok(updatedBooking(booking, now, { status: 'expired', holdExpiresAt: null }));
}
