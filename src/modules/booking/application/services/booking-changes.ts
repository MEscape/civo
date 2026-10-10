import type { TenantId } from '@modules/auth';

import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  fieldValidationFailed,
  BOOKING_VALIDATION_CODES,
} from '../../domain/errors/booking-errors';
import { cancelBooking, rescheduleBooking } from '../../domain/lifecycle/booking-lifecycle';
import { checkCancellation, checkRescheduling } from '../../domain/policies/change-policy';
import { evaluateSlot } from '../../domain/scheduling/slot-assessment';
import { parseInstant } from '../../domain/time/instant';
import { localDateOf } from '../../domain/time/time-zone';

import { loadSchedulingIndex } from './scheduling-context';

import type { BookingParts } from './own-booking';
import type { ChangeActor } from '../../domain/models/bookable-service';
import type { Booking } from '../../domain/models/booking';
import type { PublicBookingDependencies } from '../booking-dependencies';

type ChangeDependencies = Pick<PublicBookingDependencies, 'resources' | 'bookings' | 'clock'>;

export type BookingChangeError =
  ValidationAppError | NotFoundAppError | ConflictAppError | InfrastructureAppError;

/**
 * Cancels a booking if the service's policy lets this actor do it now, and
 * releases what it held. The write is conditional on the booking not having
 * changed since it was read, so two people cancelling or moving the same
 * booking cannot both win.
 */
export function cancelWithPolicy(
  deps: ChangeDependencies,
  parts: BookingParts,
  actor: ChangeActor,
): AppResultAsync<Booking, BookingChangeError> {
  const now = deps.clock.now();
  const { booking, service } = parts;
  const checked = checkCancellation(service, booking, actor, now).andThen(() =>
    cancelBooking(booking, actor, now),
  );
  if (checked.isErr()) {
    return errAsync(checked.error);
  }
  return deps.bookings.save(checked.value, booking, now);
}

/**
 * Moves a booking to another start time. The new time goes through the same
 * assessment as a new booking (with the booking itself not blocking its own
 * new time), then the move is stored atomically: the new resources are held
 * and the old ones released in one step, or nothing changes.
 */
export function rescheduleWithPolicy(
  deps: ChangeDependencies,
  tenantId: TenantId,
  parts: BookingParts,
  rawStart: string,
  actor: ChangeActor,
): AppResultAsync<Booking, BookingChangeError> {
  const now = deps.clock.now();
  const { booking, service, location } = parts;
  const allowed = checkRescheduling(service, booking, actor, now);
  if (allowed.isErr()) {
    return errAsync(allowed.error);
  }
  const start = parseInstant(rawStart);
  if (start === null) {
    return errAsync(fieldValidationFailed('start', BOOKING_VALIDATION_CODES.dateInvalid));
  }
  const day = localDateOf(start, location.timeZone);

  return loadSchedulingIndex(deps, {
    tenantId,
    service,
    location,
    range: { from: day, to: day },
    now,
    ignoreBookingId: booking.id,
  }).andThen((index) => {
    const moved = evaluateSlot(index, start, booking.participants).andThen((slot) =>
      rescheduleBooking(booking, slot, now),
    );
    if (moved.isErr()) {
      return errAsync(moved.error);
    }
    return deps.bookings.save(moved.value, booking, now);
  });
}
