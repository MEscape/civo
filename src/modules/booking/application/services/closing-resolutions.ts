import type { ConflictAppError, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES as CODES,
  fieldValidationFailed,
  serviceImpactUnresolved,
} from '../../domain/errors/booking-errors';
import { cancelBooking } from '../../domain/lifecycle/booking-lifecycle';
import { assignmentNoticesOf } from '../../domain/models/actor-message';
import { parseBookingId } from '../../domain/models/ids';
import { SERVICE_RESOLUTIONS } from '../contracts/booking-constraints';

import type { BookingId } from '../../domain/models/ids';
import type { StoredService } from '../../domain/models/stored-service';
import type { BookingChange, StoredBooking } from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';
import type { ServiceResolution } from '../contracts/booking-constraints';
import type { ServiceResolutionInput } from '../contracts/service-inputs';

/** What the manager decided for each booking, by id: read from the request, never trusted blindly. */
export function parseResolutions(
  raw: readonly ServiceResolutionInput[],
): AppResult<ReadonlyMap<BookingId, ServiceResolution>, ValidationAppError> {
  const decided = new Map<BookingId, ServiceResolution>();
  for (const [index, { bookingId, kind }] of raw.entries()) {
    const id = parseBookingId(bookingId);
    const resolution = SERVICE_RESOLUTIONS.find((candidate) => candidate === kind);
    if (id.isErr() || resolution === undefined) {
      return err(fieldValidationFailed(`resolutions.${index}`, CODES.idInvalid));
    }
    decided.set(id.value, resolution);
  }
  return ok(decided);
}

/**
 * The service as it is judged when its bookings are ended because it closes: a manager may cancel
 * them whatever the service's own cancellation rule says (that rule is for a citizen and a day to
 * day change, not for closing the service down). The deadline binds customers only already.
 */
function asClosing(service: StoredService): StoredService {
  return {
    ...service,
    cancellation: {
      ...service.cancellation,
      isAllowed: true,
      allowedActors: [...service.cancellation.allowedActors, 'manager'],
    },
  };
}

/**
 * The bookings a closing service ends, as changes to write with it. Every booking the closing
 * reaches must have a decision: one that is left unresolved (or an answer that was cut short, so
 * some were never shown) stops the closing with `booking.service_impact_unresolved`. Leaving a
 * booking is a decision; nothing is cancelled that the manager did not choose.
 */
export function cancellationsFor(request: {
  readonly service: StoredService;
  readonly bookings: readonly StoredBooking[];
  readonly isTruncated: boolean;
  readonly decided: ReadonlyMap<BookingId, ServiceResolution>;
  readonly now: Instant;
}): AppResult<
  { readonly changes: readonly BookingChange[]; readonly leftOpen: number },
  ConflictAppError
> {
  const { service, bookings, isTruncated, decided, now } = request;
  if (isTruncated || bookings.some(({ booking }) => !decided.has(booking.id))) {
    return err(serviceImpactUnresolved());
  }
  const changes: BookingChange[] = [];
  for (const stored of bookings) {
    if (decided.get(stored.booking.id) === 'cancel') {
      const cancelled = cancelBooking({
        booking: stored.booking,
        service: asClosing(service),
        actor: 'manager',
        now,
      });
      if (cancelled.isErr()) {
        return err(cancelled.error);
      }
      changes.push({
        stored: { ...stored, booking: cancelled.value },
        expected: { status: stored.booking.status, updatedAt: stored.booking.updatedAt },
        now,
        notices: assignmentNoticesOf(stored.booking, cancelled.value),
      });
    }
  }
  return ok({ changes, leftOpen: bookings.length - changes.length });
}
