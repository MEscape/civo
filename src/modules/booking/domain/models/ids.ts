import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { BOOKING_VALIDATION_CODES, fieldValidationFailed } from '../errors/booking-errors';

/** Opaque identity of a bookable service. */
export type BookableServiceId = Brand<string, 'BookableServiceId'>;

/** Opaque identity of a location (a building, a site, or a virtual place). */
export type BookingLocationId = Brand<string, 'BookingLocationId'>;

/** Opaque identity of a bookable resource (an employee, a room, a pitch, a device). */
export type BookableResourceId = Brand<string, 'BookableResourceId'>;

/** Opaque identity of a booking. */
export type BookingId = Brand<string, 'BookingId'>;

/** The booking module's own brand for a website's identity. */
export type WebsiteId = Brand<string, 'WebsiteId'>;

/** One bound for every identity in this module. */
export const BOOKING_ID_MAX_LENGTH = 128;

/**
 * Brands an id read from storage. Only infrastructure adapters call this;
 * request values go through the `parse…Id` functions.
 */
export function toBookableServiceId(raw: string): BookableServiceId {
  return raw as BookableServiceId; // Brand constructor: the cast is only permitted here.
}

export function toBookingLocationId(raw: string): BookingLocationId {
  return raw as BookingLocationId; // Brand constructor: the cast is only permitted here.
}

export function toBookableResourceId(raw: string): BookableResourceId {
  return raw as BookableResourceId; // Brand constructor: the cast is only permitted here.
}

export function toBookingId(raw: string): BookingId {
  return raw as BookingId; // Brand constructor: the cast is only permitted here.
}

/** Brands a website id read from storage or from another module's adapter. */
export function toWebsiteId(raw: string): WebsiteId {
  return raw as WebsiteId; // Brand constructor: the cast is only permitted here.
}

function hasValidShape(raw: string): boolean {
  return raw.length > 0 && raw.length <= BOOKING_ID_MAX_LENGTH;
}

const ID_INVALID = BOOKING_VALIDATION_CODES.idInvalid;

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

export const parseBookingId = createIdParser({
  isValid: hasValidShape,
  brand: toBookingId,
  mapError: () => fieldValidationFailed('bookingId', ID_INVALID),
});

export const parseWebsiteId = createIdParser({
  isValid: hasValidShape,
  brand: toWebsiteId,
  mapError: () => fieldValidationFailed('websiteId', ID_INVALID),
});
