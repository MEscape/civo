import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { BOOKING_VALIDATION_CODES, fieldValidationFailed } from '../errors/booking-errors';

/** Opaque identity of a bookable service. */
export type BookableServiceId = Brand<string, 'BookableServiceId'>;

/** Opaque identity of a location (a building, a site). */
export type BookingLocationId = Brand<string, 'BookingLocationId'>;

/** Opaque identity of a bookable resource (an employee, a room, a pitch, a device). */
export type BookableResourceId = Brand<string, 'BookableResourceId'>;

/** Opaque identity of a booking. */
export type BookingId = Brand<string, 'BookingId'>;

/** Opaque identity of a website: the scope every stored booking belongs to. */
export type WebsiteId = Brand<string, 'WebsiteId'>;

/**
 * Brand an id read from storage or handed in by the application layer, which has already checked
 * its shape (request values go through the application's id parsers). The domain treats ids as
 * opaque: it compares them and never looks inside.
 */
export function toBookableServiceId(raw: string): BookableServiceId {
  // Brand constructor: the cast is only permitted here.
  return raw as BookableServiceId;
}

export function toBookingLocationId(raw: string): BookingLocationId {
  // Brand constructor: the cast is only permitted here.
  return raw as BookingLocationId;
}

export function toBookableResourceId(raw: string): BookableResourceId {
  // Brand constructor: the cast is only permitted here.
  return raw as BookableResourceId;
}

export function toBookingId(raw: string): BookingId {
  // Brand constructor: the cast is only permitted here.
  return raw as BookingId;
}

export function toWebsiteId(raw: string): WebsiteId {
  // Brand constructor: the cast is only permitted here.
  return raw as WebsiteId;
}

/**
 * Order of two ids, in code-unit order and not locale order: the same ids sort the same
 * way on every machine. Every deterministic tie-break in the module goes through it.
 */
export function compareIds(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

/** One bound for every identity in this module. */
export const BOOKING_ID_MAX_LENGTH = 128;

function hasValidShape(raw: string): boolean {
  return raw.length > 0 && raw.length <= BOOKING_ID_MAX_LENGTH;
}

const ID_INVALID = BOOKING_VALIDATION_CODES.idInvalid;

/** Parse an id that arrives from outside (a request): only its shape can be checked here. */
export const parseBookableServiceId = createIdParser({
  isValid: hasValidShape,
  brand: toBookableServiceId,
  mapError: () => fieldValidationFailed('serviceId', ID_INVALID),
});

export const parseBookingLocationId = createIdParser({
  isValid: hasValidShape,
  brand: toBookingLocationId,
  mapError: () => fieldValidationFailed('locationId', ID_INVALID),
});

export const parseBookableResourceId = createIdParser({
  isValid: hasValidShape,
  brand: toBookableResourceId,
  mapError: () => fieldValidationFailed('resourceId', ID_INVALID),
});

export const parseWebsiteId = createIdParser({
  isValid: hasValidShape,
  brand: toWebsiteId,
  mapError: () => fieldValidationFailed('websiteId', ID_INVALID),
});

export const parseBookingId = createIdParser({
  isValid: hasValidShape,
  brand: toBookingId,
  mapError: () => fieldValidationFailed('bookingId', ID_INVALID),
});
