import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import type { Brand } from '@lib/utils';

import { BOOKING_VALIDATION_CODES, fieldValidationFailed } from '../errors/booking-errors';

/**
 * The short code a visitor is given and quotes to look a booking up
 * ("7KQ3M9XD2P"). It is not a secret on its own: changing a booking also
 * needs the e-mail address it was made with.
 */
export type BookingReference = Brand<string, 'BookingReference'>;

export const BOOKING_REFERENCE_LENGTH = 10;

/** Crockford's base 32: no I, L, O or U, so a code read over the phone survives. */
export const BOOKING_REFERENCE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const REFERENCE_PATTERN = new RegExp(
  `^[${BOOKING_REFERENCE_ALPHABET}]{${BOOKING_REFERENCE_LENGTH}}$`,
);

/** Brands a reference read from storage or produced by the generator. */
export function toBookingReference(raw: string): BookingReference {
  return raw as BookingReference; // Brand constructor: the cast is only permitted here.
}

/** Brands a reference that arrived from a request; case and surrounding spaces do not matter. */
export function parseBookingReference(
  raw: string,
): AppResult<BookingReference, ValidationAppError> {
  const normalized = raw.trim().toUpperCase();
  return REFERENCE_PATTERN.test(normalized)
    ? ok(toBookingReference(normalized))
    : err(fieldValidationFailed('reference', BOOKING_VALIDATION_CODES.referenceInvalid));
}
