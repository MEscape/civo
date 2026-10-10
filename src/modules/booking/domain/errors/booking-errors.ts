import {
  conflictError,
  infrastructureError,
  notFoundError,
  validationError,
  FieldErrorBag,
} from '@lib/errors';
import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';

/**
 * Stable codes. Presentation maps them to translation keys (i18n.md);
 * nothing here is user-facing prose.
 *
 * "Not found" deliberately covers both a missing record and another
 * tenant's record, and a booking reference with the wrong e-mail address, so
 * a visitor cannot probe which references exist.
 */
export const BOOKING_ERROR_CODES = {
  serviceNotFound: 'booking.service_not_found',
  serviceInactive: 'booking.service_inactive',
  locationNotFound: 'booking.location_not_found',
  locationUnavailable: 'booking.location_unavailable',
  resourceNotFound: 'booking.resource_not_found',
  bookingNotFound: 'booking.not_found',
  websiteNotFound: 'booking.website_not_found',
  /** The requested time cannot be booked (closed, taken, off the slot grid). */
  slotUnavailable: 'booking.slot_unavailable',
  /** No combination of qualified resources is free for the whole occupied time. */
  resourceUnavailable: 'booking.resource_unavailable',
  capacityExceeded: 'booking.capacity_exceeded',
  /** The slot was free when the visitor looked and was taken before they committed. */
  bookingConflict: 'booking.conflict',
  bookingExpired: 'booking.expired',
  /** The booking changed after the change was prepared: reload and try again. */
  bookingStale: 'booking.stale',
  invalidStateTransition: 'booking.invalid_state_transition',
  bookingNotStarted: 'booking.not_started',
  outsideBookingWindow: 'booking.outside_booking_window',
  cancellationNotAllowed: 'booking.cancellation_not_allowed',
  cancellationDeadlinePassed: 'booking.cancellation_deadline_passed',
  reschedulingNotAllowed: 'booking.rescheduling_not_allowed',
  reschedulingDeadlinePassed: 'booking.rescheduling_deadline_passed',
  tooManyActiveBookings: 'booking.too_many_active_bookings',
  tooManyActiveHolds: 'booking.too_many_active_holds',
  /** The same visitor sent too many requests in a short time. */
  rateLimited: 'booking.rate_limited',
  configurationInvalid: 'booking.configuration_invalid',
  validationFailed: 'booking.validation_failed',
  persistenceFailed: 'booking.persistence_failed',
} as const;

/** Field-level codes, carried in `fieldErrors`. Also stable, also never prose. */
export const BOOKING_VALIDATION_CODES = {
  idInvalid: 'booking.validation.id_invalid',
  referenceInvalid: 'booking.validation.reference_invalid',
  nameRequired: 'booking.validation.name_required',
  textTooLong: 'booking.validation.text_too_long',
  categoryInvalid: 'booking.validation.category_invalid',
  timeZoneInvalid: 'booking.validation.time_zone_invalid',
  dateInvalid: 'booking.validation.date_invalid',
  dateRangeInvalid: 'booking.validation.date_range_invalid',
  dateRangeTooLong: 'booking.validation.date_range_too_long',
  timeRangeInvalid: 'booking.validation.time_range_invalid',
  timeRangesOverlap: 'booking.validation.time_ranges_overlap',
  tooMany: 'booking.validation.too_many',
  exceptionKindUnknown: 'booking.validation.exception_kind_unknown',
  durationInvalid: 'booking.validation.duration_invalid',
  bufferInvalid: 'booking.validation.buffer_invalid',
  slotIntervalInvalid: 'booking.validation.slot_interval_invalid',
  noticeInvalid: 'booking.validation.notice_invalid',
  horizonInvalid: 'booking.validation.horizon_invalid',
  capacityInvalid: 'booking.validation.capacity_invalid',
  participantsInvalid: 'booking.validation.participants_invalid',
  skillInvalid: 'booking.validation.skill_invalid',
  resourceTypeUnknown: 'booking.validation.resource_type_unknown',
  requirementsRequired: 'booking.validation.requirements_required',
  requirementCountInvalid: 'booking.validation.requirement_count_invalid',
  locationsRequired: 'booking.validation.locations_required',
  informationFieldUnknown: 'booking.validation.information_field_unknown',
  emailRequired: 'booking.validation.email_required',
  emailInvalid: 'booking.validation.email_invalid',
  fieldRequired: 'booking.validation.field_required',
  changePolicyInvalid: 'booking.validation.change_policy_invalid',
  actorUnknown: 'booking.validation.actor_unknown',
  statusUnknown: 'booking.validation.status_unknown',
} as const;

export type BookingErrorCode = (typeof BOOKING_ERROR_CODES)[keyof typeof BOOKING_ERROR_CODES];
export type BookingValidationCode =
  (typeof BOOKING_VALIDATION_CODES)[keyof typeof BOOKING_VALIDATION_CODES];
export type BookingCode = BookingErrorCode | BookingValidationCode;

const CODES = BOOKING_ERROR_CODES;

export function serviceNotFound(): NotFoundAppError {
  return notFoundError(CODES.serviceNotFound, 'The service was not found.');
}

export function locationNotFound(): NotFoundAppError {
  return notFoundError(CODES.locationNotFound, 'The location was not found.');
}

export function resourceNotFound(): NotFoundAppError {
  return notFoundError(CODES.resourceNotFound, 'The resource was not found.');
}

/** Covers another tenant's booking and a reference given with the wrong e-mail address alike. */
export function bookingNotFound(): NotFoundAppError {
  return notFoundError(CODES.bookingNotFound, 'The booking was not found.');
}

export function websiteNotFoundForBooking(): NotFoundAppError {
  return notFoundError(CODES.websiteNotFound, 'The website was not found.');
}

export function serviceInactive(): ConflictAppError {
  return conflictError(CODES.serviceInactive, 'The service cannot be booked at the moment.');
}

export function locationUnavailable(): ConflictAppError {
  return conflictError(CODES.locationUnavailable, 'The service is not offered at this location.');
}

export function slotUnavailable(): ConflictAppError {
  return conflictError(CODES.slotUnavailable, 'The selected time is not available.');
}

export function resourceUnavailable(): ConflictAppError {
  return conflictError(
    CODES.resourceUnavailable,
    'No qualified resource is free for the whole appointment.',
  );
}

export function capacityExceeded(): ConflictAppError {
  return conflictError(CODES.capacityExceeded, 'Not enough places are left for this time.');
}

export function bookingConflict(): ConflictAppError {
  return conflictError(CODES.bookingConflict, 'The selected time was taken in the meantime.');
}

export function bookingExpired(): ConflictAppError {
  return conflictError(CODES.bookingExpired, 'The reservation has expired.');
}

export function bookingStale(): ConflictAppError {
  return conflictError(CODES.bookingStale, 'The booking was changed in the meantime.');
}

export function invalidStateTransition(from: string, event: string): ConflictAppError {
  return conflictError(
    CODES.invalidStateTransition,
    `A ${from} booking cannot be changed by "${event}".`,
  );
}

export function bookingNotStarted(): ConflictAppError {
  return conflictError(CODES.bookingNotStarted, 'The appointment has not started yet.');
}

export function outsideBookingWindow(): ConflictAppError {
  return conflictError(
    CODES.outsideBookingWindow,
    'The selected time is outside the period in which this service can be booked.',
  );
}

export function cancellationNotAllowed(): ConflictAppError {
  return conflictError(CODES.cancellationNotAllowed, 'This booking cannot be cancelled.');
}

export function cancellationDeadlinePassed(): ConflictAppError {
  return conflictError(
    CODES.cancellationDeadlinePassed,
    'The deadline for cancelling this booking has passed.',
  );
}

export function reschedulingNotAllowed(): ConflictAppError {
  return conflictError(CODES.reschedulingNotAllowed, 'This booking cannot be rescheduled.');
}

export function reschedulingDeadlinePassed(): ConflictAppError {
  return conflictError(
    CODES.reschedulingDeadlinePassed,
    'The deadline for rescheduling this booking has passed.',
  );
}

export function tooManyActiveBookings(): ConflictAppError {
  return conflictError(
    CODES.tooManyActiveBookings,
    'There are too many open bookings for this contact.',
  );
}

export function tooManyActiveHolds(): ConflictAppError {
  return conflictError(
    CODES.tooManyActiveHolds,
    'Too many reservations are in progress. Please try again shortly.',
  );
}

export function rateLimited(): ConflictAppError {
  return conflictError(CODES.rateLimited, 'Too many requests. Please wait a moment and try again.');
}

/** Stored configuration that cannot be scheduled (for example a service whose resource pool is empty by construction). */
export function configurationInvalid(): ConflictAppError {
  return conflictError(CODES.configurationInvalid, 'The booking configuration is incomplete.');
}

export function bookingValidationFailed(fieldErrors: Record<string, string[]>): ValidationAppError {
  return validationError(CODES.validationFailed, 'The booking input is invalid.', fieldErrors);
}

/** One place wires the bag to this module's error factory. */
export function createBookingErrorBag(): FieldErrorBag {
  return new FieldErrorBag(bookingValidationFailed);
}

/** A validation failure on a single field. */
export function fieldValidationFailed(
  field: string,
  code: BookingValidationCode,
): ValidationAppError {
  return bookingValidationFailed({ [field]: [code] });
}

/** Copies the field errors of a nested validation (a schedule inside a location) into the caller's bag. */
export function addFieldErrors(bag: FieldErrorBag, error: ValidationAppError): void {
  for (const [field, codes] of Object.entries(error.fieldErrors)) {
    for (const code of codes) {
      bag.add(field, code);
    }
  }
}

export function persistenceFailed(cause: unknown): InfrastructureAppError {
  return infrastructureError(CODES.persistenceFailed, 'Booking persistence failed.', cause);
}
