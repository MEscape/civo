import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors/validation';
import type { NestedKeyOf } from '@lib/errors/validation';

import {
  BOOKING_ERROR_CODES as ERRORS,
  BOOKING_VALIDATION_CODES as VALIDATION,
  CUSTOMER_LIMITS,
  EXCEPTION_KINDS,
  HOLD_MINUTES,
  INFORMATION_FIELDS,
  LOCATION_LIMITS,
  MAX_CUSTOMER_RESCHEDULES,
  RESOURCE_LIMITS,
  RESOURCE_TYPES,
  SERVICE_LIMITS,
  WEEKDAYS,
} from '../../application/contracts/booking-constraints';

import type {
  BookingCode,
  BookingStatus,
  ChangeActor,
  InformationField,
  ResourceKind,
  Weekday,
} from '../../application/contracts/booking-constraints';

type ValidKeys = NestedKeyOf<MessageCatalog['booking']>;

/**
 * Codes -> translation keys. `satisfies Record<BookingCode, ...>` makes a new
 * code fail to compile until it has a message.
 */
export const MESSAGE_KEY_BY_CODE = {
  [ERRORS.serviceNotFound]: fieldPath('errors', 'serviceNotFound'),
  [ERRORS.serviceInactive]: fieldPath('errors', 'serviceInactive'),
  [ERRORS.locationNotFound]: fieldPath('errors', 'locationNotFound'),
  [ERRORS.locationUnavailable]: fieldPath('errors', 'locationUnavailable'),
  [ERRORS.resourceNotFound]: fieldPath('errors', 'resourceNotFound'),
  [ERRORS.bookingNotFound]: fieldPath('errors', 'bookingNotFound'),
  [ERRORS.websiteNotFound]: fieldPath('errors', 'websiteNotFound'),
  [ERRORS.slotUnavailable]: fieldPath('errors', 'slotUnavailable'),
  [ERRORS.resourceUnavailable]: fieldPath('errors', 'resourceUnavailable'),
  [ERRORS.capacityExceeded]: fieldPath('errors', 'capacityExceeded'),
  [ERRORS.bookingConflict]: fieldPath('errors', 'bookingConflict'),
  [ERRORS.bookingExpired]: fieldPath('errors', 'bookingExpired'),
  [ERRORS.bookingStale]: fieldPath('errors', 'bookingStale'),
  [ERRORS.invalidStateTransition]: fieldPath('errors', 'invalidStateTransition'),
  [ERRORS.bookingNotStarted]: fieldPath('errors', 'bookingNotStarted'),
  [ERRORS.outsideBookingWindow]: fieldPath('errors', 'outsideBookingWindow'),
  [ERRORS.cancellationNotAllowed]: fieldPath('errors', 'cancellationNotAllowed'),
  [ERRORS.cancellationDeadlinePassed]: fieldPath('errors', 'cancellationDeadlinePassed'),
  [ERRORS.reschedulingNotAllowed]: fieldPath('errors', 'reschedulingNotAllowed'),
  [ERRORS.reschedulingDeadlinePassed]: fieldPath('errors', 'reschedulingDeadlinePassed'),
  [ERRORS.tooManyActiveBookings]: fieldPath('errors', 'tooManyActiveBookings'),
  [ERRORS.tooManyActiveHolds]: fieldPath('errors', 'tooManyActiveHolds'),
  [ERRORS.rateLimited]: fieldPath('errors', 'rateLimited'),
  [ERRORS.configurationInvalid]: fieldPath('errors', 'configurationInvalid'),
  [ERRORS.validationFailed]: fieldPath('errors', 'validation'),
  [ERRORS.persistenceFailed]: fieldPath('errors', 'infrastructure'),
  [VALIDATION.idInvalid]: fieldPath('validation', 'idInvalid'),
  [VALIDATION.referenceInvalid]: fieldPath('validation', 'referenceInvalid'),
  [VALIDATION.nameRequired]: fieldPath('validation', 'nameRequired'),
  [VALIDATION.textTooLong]: fieldPath('validation', 'textTooLong'),
  [VALIDATION.categoryInvalid]: fieldPath('validation', 'categoryInvalid'),
  [VALIDATION.timeZoneInvalid]: fieldPath('validation', 'timeZoneInvalid'),
  [VALIDATION.dateInvalid]: fieldPath('validation', 'dateInvalid'),
  [VALIDATION.dateRangeInvalid]: fieldPath('validation', 'dateRangeInvalid'),
  [VALIDATION.dateRangeTooLong]: fieldPath('validation', 'dateRangeTooLong'),
  [VALIDATION.timeRangeInvalid]: fieldPath('validation', 'timeRangeInvalid'),
  [VALIDATION.timeRangesOverlap]: fieldPath('validation', 'timeRangesOverlap'),
  [VALIDATION.tooMany]: fieldPath('validation', 'tooMany'),
  [VALIDATION.exceptionKindUnknown]: fieldPath('validation', 'exceptionKindUnknown'),
  [VALIDATION.durationInvalid]: fieldPath('validation', 'durationInvalid'),
  [VALIDATION.bufferInvalid]: fieldPath('validation', 'bufferInvalid'),
  [VALIDATION.slotIntervalInvalid]: fieldPath('validation', 'slotIntervalInvalid'),
  [VALIDATION.noticeInvalid]: fieldPath('validation', 'noticeInvalid'),
  [VALIDATION.horizonInvalid]: fieldPath('validation', 'horizonInvalid'),
  [VALIDATION.capacityInvalid]: fieldPath('validation', 'capacityInvalid'),
  [VALIDATION.participantsInvalid]: fieldPath('validation', 'participantsInvalid'),
  [VALIDATION.skillInvalid]: fieldPath('validation', 'skillInvalid'),
  [VALIDATION.resourceTypeUnknown]: fieldPath('validation', 'resourceTypeUnknown'),
  [VALIDATION.requirementsRequired]: fieldPath('validation', 'requirementsRequired'),
  [VALIDATION.requirementCountInvalid]: fieldPath('validation', 'requirementCountInvalid'),
  [VALIDATION.locationsRequired]: fieldPath('validation', 'locationsRequired'),
  [VALIDATION.informationFieldUnknown]: fieldPath('validation', 'informationFieldUnknown'),
  [VALIDATION.emailRequired]: fieldPath('validation', 'emailRequired'),
  [VALIDATION.emailInvalid]: fieldPath('validation', 'emailInvalid'),
  [VALIDATION.fieldRequired]: fieldPath('validation', 'fieldRequired'),
  [VALIDATION.changePolicyInvalid]: fieldPath('validation', 'changePolicyInvalid'),
  [VALIDATION.actorUnknown]: fieldPath('validation', 'actorUnknown'),
  [VALIDATION.statusUnknown]: fieldPath('validation', 'statusUnknown'),
} as const satisfies Record<BookingCode, ValidKeys>;

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('errors', 'unexpected');

/**
 * Codes that belong to the authorization module. They are listed here as
 * plain text because this module may not import another module's internals;
 * an unknown code still falls back to the generic message.
 */
const FOREIGN_MESSAGE_KEY_BY_CODE = {
  'auth.unauthenticated': fieldPath('errors', 'signInRequired'),
  'auth.session_expired': fieldPath('errors', 'signInRequired'),
  'auth.permission_denied': fieldPath('errors', 'permissionDenied'),
} as const satisfies Readonly<Record<string, ValidKeys>>;

/** Every message a code can resolve to: a leaf of the catalog, never a group of messages. */
export type MessageKey =
  | (typeof MESSAGE_KEY_BY_CODE)[BookingCode]
  | (typeof FOREIGN_MESSAGE_KEY_BY_CODE)[keyof typeof FOREIGN_MESSAGE_KEY_BY_CODE]
  | typeof GENERIC_ERROR_MESSAGE_KEY;

function isBookingCode(code: string): code is BookingCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

function isForeignCode(code: string): code is keyof typeof FOREIGN_MESSAGE_KEY_BY_CODE {
  return Object.hasOwn(FOREIGN_MESSAGE_KEY_BY_CODE, code);
}

export function messageKeyForCode(code: string): MessageKey {
  if (isBookingCode(code)) {
    return MESSAGE_KEY_BY_CODE[code];
  }
  return isForeignCode(code) ? FOREIGN_MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}

/** Interpolation values for messages that mention a limit. */
export const MESSAGE_PARAMS = {
  nameMax: SERVICE_LIMITS.nameMax,
  locationNameMax: LOCATION_LIMITS.nameMax,
  addressMax: LOCATION_LIMITS.addressMax,
  resourceNameMax: RESOURCE_LIMITS.nameMax,
  notesMax: CUSTOMER_LIMITS.notesMax,
  textMax: SERVICE_LIMITS.descriptionMax,
  durationMin: SERVICE_LIMITS.durationMin,
  durationMax: SERVICE_LIMITS.durationMax,
  bufferMax: SERVICE_LIMITS.bufferMax,
  slotIntervalMin: SERVICE_LIMITS.slotIntervalMin,
  slotIntervalMax: SERVICE_LIMITS.slotIntervalMax,
  horizonMax: SERVICE_LIMITS.horizonDaysMax,
  participantsMax: SERVICE_LIMITS.participantsMax,
  capacityMax: RESOURCE_LIMITS.capacityMax,
  requirementCountMax: SERVICE_LIMITS.requirementCountMax,
  holdMinutes: HOLD_MINUTES,
  maxReschedules: MAX_CUSTOMER_RESCHEDULES,
} as const;

export const STATUS_MESSAGE_KEYS = {
  held: fieldPath('status', 'held'),
  confirmed: fieldPath('status', 'confirmed'),
  cancelled: fieldPath('status', 'cancelled'),
  completed: fieldPath('status', 'completed'),
  no_show: fieldPath('status', 'no_show'),
  expired: fieldPath('status', 'expired'),
} as const satisfies Record<BookingStatus, ValidKeys>;

export const RESOURCE_TYPE_MESSAGE_KEYS = {
  employee: fieldPath('resourceTypes', 'employee'),
  room: fieldPath('resourceTypes', 'room'),
  office: fieldPath('resourceTypes', 'office'),
  'service-desk': fieldPath('resourceTypes', 'serviceDesk'),
  'sports-field': fieldPath('resourceTypes', 'sportsField'),
  'meeting-room': fieldPath('resourceTypes', 'meetingRoom'),
  vehicle: fieldPath('resourceTypes', 'vehicle'),
  equipment: fieldPath('resourceTypes', 'equipment'),
  facility: fieldPath('resourceTypes', 'facility'),
  workstation: fieldPath('resourceTypes', 'workstation'),
  other: fieldPath('resourceTypes', 'other'),
} as const satisfies Record<ResourceKind, ValidKeys>;

export const INFORMATION_FIELD_MESSAGE_KEYS = {
  firstName: fieldPath('fields', 'firstName'),
  lastName: fieldPath('fields', 'lastName'),
  email: fieldPath('fields', 'email'),
  phone: fieldPath('fields', 'phone'),
  referenceNumber: fieldPath('fields', 'referenceNumber'),
  notes: fieldPath('fields', 'notes'),
} as const satisfies Record<InformationField, ValidKeys>;

export const WEEKDAY_MESSAGE_KEYS = {
  1: fieldPath('weekdays', 'monday'),
  2: fieldPath('weekdays', 'tuesday'),
  3: fieldPath('weekdays', 'wednesday'),
  4: fieldPath('weekdays', 'thursday'),
  5: fieldPath('weekdays', 'friday'),
  6: fieldPath('weekdays', 'saturday'),
  7: fieldPath('weekdays', 'sunday'),
} as const satisfies Record<Weekday, ValidKeys>;

export const EXCEPTION_KIND_MESSAGE_KEYS = {
  closed: fieldPath('exceptionKinds', 'closed'),
  override: fieldPath('exceptionKinds', 'override'),
  additional: fieldPath('exceptionKinds', 'additional'),
} as const satisfies Record<(typeof EXCEPTION_KINDS)[number], ValidKeys>;

export const CHANGE_ACTOR_MESSAGE_KEYS = {
  customer: fieldPath('actors', 'customer'),
  staff: fieldPath('actors', 'staff'),
} as const satisfies Record<ChangeActor, ValidKeys>;

/** The list orders the forms offer, so a new value cannot be forgotten in a form. */
export const FORM_OPTIONS = {
  resourceTypes: RESOURCE_TYPES,
  informationFields: INFORMATION_FIELDS,
  exceptionKinds: EXCEPTION_KINDS,
  weekdays: WEEKDAYS,
} as const;
