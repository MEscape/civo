import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES,
  fieldValidationFailed,
} from '../../domain/errors/booking-errors';
import {
  parseBookableResourceId,
  parseBookableServiceId,
  parseBookingLocationId,
} from '../../domain/models/ids';
import { parseInstant } from '../../domain/time/instant';

import type { BookableService } from '../../domain/models/bookable-service';
import type { BookingFilter } from '../../domain/ports/booking.repository';
import type { GetOperationsCalendarInput } from '../contracts/booking-inputs';

/**
 * A group size from a request, checked against what the service allows. The
 * scheduling engine would reject a bad size too, but as "no slots"; a clear
 * validation error is what a form can show.
 */
export function parseParticipants(
  service: BookableService,
  raw: number,
): AppResult<number, ValidationAppError> {
  return Number.isInteger(raw) && raw >= 1 && raw <= service.capacity.participantsPerBooking
    ? ok(raw)
    : err(fieldValidationFailed('participants', BOOKING_VALIDATION_CODES.participantsInvalid));
}

/** An instant with an explicit offset, from a request. */
export function parseStart(raw: string): AppResult<number, ValidationAppError> {
  const start = parseInstant(raw);
  return start === null
    ? err(fieldValidationFailed('start', BOOKING_VALIDATION_CODES.dateInvalid))
    : ok(start);
}

function parseOptional<T>(
  raw: string | undefined,
  parse: (value: string) => AppResult<T, ValidationAppError>,
): AppResult<T | undefined, ValidationAppError> {
  return raw === undefined ? ok(undefined) : parse(raw);
}

/** The optional narrowing of the operations calendar; an id that is present must be well formed. */
export function parseBookingFilter(
  input: Pick<GetOperationsCalendarInput, 'locationId' | 'serviceId' | 'resourceId'>,
): AppResult<BookingFilter, ValidationAppError> {
  return parseOptional(input.locationId, parseBookingLocationId).andThen((locationId) =>
    parseOptional(input.serviceId, parseBookableServiceId).andThen((serviceId) =>
      parseOptional(input.resourceId, parseBookableResourceId).map((resourceId) => ({
        locationId,
        serviceId,
        resourceId,
      })),
    ),
  );
}
