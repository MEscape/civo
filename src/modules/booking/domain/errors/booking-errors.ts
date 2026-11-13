import {
  FieldErrorBag,
  conflictError,
  infrastructureError,
  notFoundError,
  rateLimitedError,
  validationError,
} from '@lib/errors';
import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  ValidationAppError,
} from '@lib/errors';
import type { RateLimitFailure } from '@lib/rate-limit';

/**
 * Stable codes. Presentation maps them to translation keys (i18n.md); nothing here is
 * user-facing prose, and callers decide on the code, never on the message.
 */
export const BOOKING_ERROR_CODES = {
  validationFailed: 'booking.validation_failed',
  invalidStateTransition: 'booking.invalid_state_transition',
  bookingExpired: 'booking.expired',
  holdNotExpired: 'booking.hold_not_expired',
  bookingNotStarted: 'booking.not_started',
  serviceInactive: 'booking.service_inactive',
  locationNotOffered: 'booking.location_not_offered',
  slotUnavailable: 'booking.slot_unavailable',
  assignmentIncomplete: 'booking.assignment_incomplete',
  alreadyAssigned: 'booking.already_assigned',
  notAssigned: 'booking.not_assigned',
  notEligible: 'booking.not_eligible',
  unassignNotAllowed: 'booking.unassign_not_allowed',
  bookingStarted: 'booking.started',
  cancellationNotAllowed: 'booking.cancellation_not_allowed',
  cancellationDeadlinePassed: 'booking.cancellation_deadline_passed',
  reschedulingNotAllowed: 'booking.rescheduling_not_allowed',
  reschedulingDeadlinePassed: 'booking.rescheduling_deadline_passed',
  reschedulingLimitReached: 'booking.rescheduling_limit_reached',
  // Storage: another write got there first, or the stored data is not what the rules expect.
  resourceTaken: 'booking.resource_taken',
  capacityExceeded: 'booking.capacity_exceeded',
  bookingStale: 'booking.stale',
  referenceTaken: 'booking.reference_taken',
  bookingNotFound: 'booking.not_found',
  persistenceFailed: 'booking.persistence_failed',
  // The setup a booking refers to.
  websiteNotFound: 'booking.website_not_found',
  scheduleTooLarge: 'booking.schedule_too_large',
  serviceNotFound: 'booking.service_not_found',
  locationNotFound: 'booking.location_not_found',
  resourceNotFound: 'booking.resource_not_found',
  // Abuse bounds of the public flow.
  tooManyHolds: 'booking.too_many_holds',
  tooManyBookings: 'booking.too_many_bookings',
  rateLimited: 'booking.rate_limited',
  rateLimiterFailed: 'booking.rate_limiter_failed',
  // The caller may not act on this booking in this way.
  notYourBooking: 'booking.not_your_booking',
  notClaimable: 'booking.not_claimable',
  // Changing a location.
  timeZoneLocked: 'booking.time_zone_locked',
  locationImpactUnacknowledged: 'booking.location_impact_unacknowledged',
  locationStale: 'booking.location_stale',
  // Changing a service.
  serviceStale: 'booking.service_stale',
  serviceSharedUnacknowledged: 'booking.service_shared_unacknowledged',
  serviceImpactUnresolved: 'booking.service_impact_unresolved',
  serviceAlreadyOffered: 'booking.service_already_offered',
  // Changing a resource.
  resourceStale: 'booking.resource_stale',
  resourceImpactUnacknowledged: 'booking.resource_impact_unacknowledged',
  // The team (employees' calendars).
  employeeAlreadySetUp: 'booking.employee_already_set_up',
} as const;

/** Field-level codes, carried in `fieldErrors`. Also stable, also never prose. */
export const BOOKING_VALIDATION_CODES = {
  dateRangeInvalid: 'booking.validation.date_range_invalid',
  dateRangeTooLong: 'booking.validation.date_range_too_long',
  durationInvalid: 'booking.validation.duration_invalid',
  bufferInvalid: 'booking.validation.buffer_invalid',
  slotIntervalInvalid: 'booking.validation.slot_interval_invalid',
  noticeInvalid: 'booking.validation.notice_invalid',
  horizonInvalid: 'booking.validation.horizon_invalid',
  requirementCountInvalid: 'booking.validation.requirement_count_invalid',
  tooMany: 'booking.validation.too_many',
  fieldRequired: 'booking.validation.field_required',
  idInvalid: 'booking.validation.id_invalid',
  referenceInvalid: 'booking.validation.reference_invalid',
  startInvalid: 'booking.validation.start_invalid',
  emailInvalid: 'booking.validation.email_invalid',
  limitInvalid: 'booking.validation.limit_invalid',
  nameInvalid: 'booking.validation.name_invalid',
  addressInvalid: 'booking.validation.address_invalid',
  timeZoneInvalid: 'booking.validation.time_zone_invalid',
  weekInvalid: 'booking.validation.week_invalid',
  timeRangeInvalid: 'booking.validation.time_range_invalid',
  timeRangesOverlap: 'booking.validation.time_ranges_overlap',
  breakOutsideHours: 'booking.validation.break_outside_hours',
  exceptionInvalid: 'booking.validation.exception_invalid',
  exceptionsOverlap: 'booking.validation.exceptions_overlap',
  coverageOverlap: 'booking.validation.coverage_overlap',
  categoryInvalid: 'booking.validation.category_invalid',
  descriptionInvalid: 'booking.validation.description_invalid',
  documentsInvalid: 'booking.validation.documents_invalid',
  instructionsInvalid: 'booking.validation.instructions_invalid',
  noteInvalid: 'booking.validation.note_invalid',
  actorsRequired: 'booking.validation.actors_required',
  noticeNotBeforeHorizon: 'booking.validation.notice_not_before_horizon',
  deadlineInvalid: 'booking.validation.deadline_invalid',
  resourceInvalid: 'booking.validation.resource_invalid',
  qualificationInvalid: 'booking.validation.qualification_invalid',
  adoptModeInvalid: 'booking.validation.adopt_mode_invalid',
  resourceTypeInvalid: 'booking.validation.resource_type_invalid',
  capacityInvalid: 'booking.validation.capacity_invalid',
  locationInvalid: 'booking.validation.location_invalid',
  serviceInvalid: 'booking.validation.service_invalid',
  hoursOutsideLocation: 'booking.validation.hours_outside_location',
} as const;

function bookingValidationFailed(fieldErrors: Record<string, string[]>): ValidationAppError {
  return validationError(
    BOOKING_ERROR_CODES.validationFailed,
    'The booking input is invalid.',
    fieldErrors,
  );
}

/** One place wires the bag to this module's error factory. */
export function createBookingErrorBag(): FieldErrorBag {
  return new FieldErrorBag(bookingValidationFailed);
}

/** A validation failure on a single field. */
export function fieldValidationFailed(
  field: string,
  code: (typeof BOOKING_VALIDATION_CODES)[keyof typeof BOOKING_VALIDATION_CODES],
): ValidationAppError {
  return bookingValidationFailed({ [field]: [code] });
}

/** A rule of the booking domain refused the attempt: the code says which. */
export function bookingConflict(
  code: (typeof BOOKING_ERROR_CODES)[Exclude<keyof typeof BOOKING_ERROR_CODES, 'validationFailed'>],
  message: string,
): ConflictAppError {
  return conflictError(code, message);
}

/** The booking asked for does not exist in this website (another website's booking looks the same). */
export function bookingNotFound(): NotFoundAppError {
  return notFoundError(BOOKING_ERROR_CODES.bookingNotFound, 'The booking does not exist.');
}

/**
 * Data on its way to or from storage is not in the shape the rules expect: a corrupt row, a JSON
 * column of an unknown shape, a booking that breaks its own invariants. A bug or damaged data,
 * never a user's mistake, so it is an infrastructure failure; `what` names the part, never a value.
 */
export function bookingDataInvalid(what: string): InfrastructureAppError {
  return infrastructureError(
    BOOKING_ERROR_CODES.persistenceFailed,
    'Booking data is not in the shape the rules expect.',
    new Error(what),
  );
}

/** The setup a booking refers to is not in this website (another website's looks the same). */
export function serviceNotFound(): NotFoundAppError {
  return notFoundError(BOOKING_ERROR_CODES.serviceNotFound, 'The service does not exist.');
}

export function locationNotFound(): NotFoundAppError {
  return notFoundError(BOOKING_ERROR_CODES.locationNotFound, 'The location does not exist.');
}

export function resourceNotFound(): NotFoundAppError {
  return notFoundError(BOOKING_ERROR_CODES.resourceNotFound, 'The resource does not exist.');
}

/** Too many reservations are waiting for their visitor; try again when some have run out. */
export function tooManyHolds(): ConflictAppError {
  return conflictError(
    BOOKING_ERROR_CODES.tooManyHolds,
    'Too many reservations are open right now.',
  );
}

/** This e-mail address already has as many bookings as one address may have. */
export function tooManyBookings(): ConflictAppError {
  return conflictError(
    BOOKING_ERROR_CODES.tooManyBookings,
    'There are too many bookings for this address.',
  );
}

/** A refusal of the shared limiter, in this module's own codes, so its message table stays complete. */
export function fromRateLimitFailure(
  failure: RateLimitFailure,
): RateLimitedAppError | InfrastructureAppError {
  return failure.kind === 'rate_limited'
    ? rateLimitedError(
        BOOKING_ERROR_CODES.rateLimited,
        'Too many requests. Please wait a moment and try again.',
        failure.retryAfterSeconds,
      )
    : infrastructureError(
        BOOKING_ERROR_CODES.rateLimiterFailed,
        'The request limit could not be checked.',
        failure.cause,
      );
}

/** The website named by a public request does not exist. */
export function websiteNotFound(): NotFoundAppError {
  return notFoundError(BOOKING_ERROR_CODES.websiteNotFound, 'The website does not exist.');
}

/** Too many bookings block the span asked about for one answer: ask for a shorter span. */
export function scheduleTooLarge(): ConflictAppError {
  return conflictError(
    BOOKING_ERROR_CODES.scheduleTooLarge,
    'There are too many bookings in this period to answer; ask for a shorter one.',
  );
}

/** The time zone of a location with future bookings cannot change: every booking is a moment on that clock. */
export function timeZoneLocked(): ConflictAppError {
  return conflictError(
    BOOKING_ERROR_CODES.timeZoneLocked,
    'The time zone of a location with upcoming bookings cannot be changed.',
  );
}

/** The change would leave bookings outside the opening hours and the manager has not said they stay. */
export function locationImpactUnacknowledged(): ConflictAppError {
  return conflictError(
    BOOKING_ERROR_CODES.locationImpactUnacknowledged,
    'The change affects existing bookings; review them before saving.',
  );
}

/** The location was changed by somebody else since it was read. */
export function locationStale(): ConflictAppError {
  return conflictError(BOOKING_ERROR_CODES.locationStale, 'The location has changed.');
}

/** The resource was changed by somebody else since it was read. */
export function resourceStale(): ConflictAppError {
  return conflictError(BOOKING_ERROR_CODES.resourceStale, 'The resource has changed.');
}

/** A change of when a resource can be used, or of its places, leaves bookings without it; nobody has looked at them. */
export function resourceImpactUnacknowledged(): ConflictAppError {
  return conflictError(
    BOOKING_ERROR_CODES.resourceImpactUnacknowledged,
    'The change affects existing bookings; review them before saving.',
  );
}

/** The member already has a calendar: one per member (EX-19). */
export function employeeAlreadySetUp(): ConflictAppError {
  return conflictError(
    BOOKING_ERROR_CODES.employeeAlreadySetUp,
    'The member already has a calendar.',
  );
}

/** The service was changed by somebody else since it was read. */
export function serviceStale(): ConflictAppError {
  return conflictError(BOOKING_ERROR_CODES.serviceStale, 'The service has changed.');
}

/** The change reaches the same service at other locations and the manager has not said that is meant. */
export function serviceSharedUnacknowledged(): ConflictAppError {
  return conflictError(
    BOOKING_ERROR_CODES.serviceSharedUnacknowledged,
    'The change applies to every location that offers the service.',
  );
}

/** Closing the service was to settle its bookings and some have no decision yet. */
export function serviceImpactUnresolved(): ConflictAppError {
  return conflictError(
    BOOKING_ERROR_CODES.serviceImpactUnresolved,
    'Every booking of the service needs a decision before it is closed.',
  );
}

/** The service is already switched on at that location. */
export function serviceAlreadyOffered(): ConflictAppError {
  return conflictError(
    BOOKING_ERROR_CODES.serviceAlreadyOffered,
    'The service is already offered at this location.',
  );
}
