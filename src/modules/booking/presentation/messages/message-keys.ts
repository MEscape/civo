import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors';
import type { NestedKeyOf } from '@lib/errors';

import {
  BOOKING_ERROR_CODES as ERRORS,
  BOOKING_VALIDATION_CODES as VALIDATION,
  LOCATION_LIMITS,
  SERVICE_LIMITS,
} from '../../application/contracts/booking-constraints';

import type {
  ChangeActor,
  ExceptionKind,
  GermanRegion,
  HolidayKey,
  ResourceKind,
} from '../../application/contracts/booking-constraints';
import type { AssignmentCandidatesDto, BookingDto } from '../dto/booking-dto';
import type { AffectedBookingDto } from '../dto/location-dto';
import type { WeekTemplateKey } from '../forms/week/templates';

type ValidKeys = NestedKeyOf<MessageCatalog['booking']>;

type BookingCode =
  (typeof ERRORS)[keyof typeof ERRORS] | (typeof VALIDATION)[keyof typeof VALIDATION];

/**
 * Codes -> translation keys, relative to the `booking` namespace. `satisfies Record<BookingCode, …>`
 * makes a new code fail to compile until it has a message. Several storage and infrastructure codes
 * share one message on purpose: what a person can do about them is the same.
 */
export const MESSAGE_KEY_BY_CODE = {
  [ERRORS.validationFailed]: fieldPath('errors', 'validation'),
  [ERRORS.invalidStateTransition]: fieldPath('errors', 'invalidStateTransition'),
  [ERRORS.bookingExpired]: fieldPath('errors', 'bookingExpired'),
  [ERRORS.holdNotExpired]: fieldPath('errors', 'holdNotExpired'),
  [ERRORS.bookingNotStarted]: fieldPath('errors', 'bookingNotStarted'),
  [ERRORS.serviceInactive]: fieldPath('errors', 'serviceInactive'),
  [ERRORS.locationNotOffered]: fieldPath('errors', 'locationNotOffered'),
  [ERRORS.slotUnavailable]: fieldPath('errors', 'slotUnavailable'),
  [ERRORS.assignmentIncomplete]: fieldPath('errors', 'assignmentIncomplete'),
  [ERRORS.alreadyAssigned]: fieldPath('errors', 'alreadyAssigned'),
  [ERRORS.notAssigned]: fieldPath('errors', 'notAssigned'),
  [ERRORS.notEligible]: fieldPath('errors', 'notEligible'),
  [ERRORS.unassignNotAllowed]: fieldPath('errors', 'unassignNotAllowed'),
  [ERRORS.bookingStarted]: fieldPath('errors', 'bookingStarted'),
  [ERRORS.cancellationNotAllowed]: fieldPath('errors', 'cancellationNotAllowed'),
  [ERRORS.cancellationDeadlinePassed]: fieldPath('errors', 'cancellationDeadlinePassed'),
  [ERRORS.reschedulingNotAllowed]: fieldPath('errors', 'reschedulingNotAllowed'),
  [ERRORS.reschedulingDeadlinePassed]: fieldPath('errors', 'reschedulingDeadlinePassed'),
  [ERRORS.reschedulingLimitReached]: fieldPath('errors', 'reschedulingLimitReached'),
  [ERRORS.resourceTaken]: fieldPath('errors', 'resourceTaken'),
  [ERRORS.capacityExceeded]: fieldPath('errors', 'capacityExceeded'),
  [ERRORS.bookingStale]: fieldPath('errors', 'bookingStale'),
  [ERRORS.referenceTaken]: fieldPath('errors', 'referenceTaken'),
  [ERRORS.bookingNotFound]: fieldPath('errors', 'bookingNotFound'),
  [ERRORS.persistenceFailed]: fieldPath('errors', 'infrastructure'),
  [ERRORS.websiteNotFound]: fieldPath('errors', 'websiteNotFound'),
  [ERRORS.scheduleTooLarge]: fieldPath('errors', 'scheduleTooLarge'),
  [ERRORS.serviceNotFound]: fieldPath('errors', 'serviceNotFound'),
  [ERRORS.locationNotFound]: fieldPath('errors', 'locationNotFound'),
  [ERRORS.resourceNotFound]: fieldPath('errors', 'resourceNotFound'),
  [ERRORS.tooManyHolds]: fieldPath('errors', 'tooManyHolds'),
  [ERRORS.tooManyBookings]: fieldPath('errors', 'tooManyBookings'),
  [ERRORS.rateLimited]: fieldPath('errors', 'rateLimited'),
  [ERRORS.rateLimiterFailed]: fieldPath('errors', 'infrastructure'),
  [ERRORS.notYourBooking]: fieldPath('errors', 'notYourBooking'),
  [ERRORS.notClaimable]: fieldPath('errors', 'notClaimable'),
  [ERRORS.timeZoneLocked]: fieldPath('errors', 'timeZoneLocked'),
  [ERRORS.locationImpactUnacknowledged]: fieldPath('errors', 'locationImpactUnacknowledged'),
  [ERRORS.locationStale]: fieldPath('errors', 'locationStale'),
  [ERRORS.serviceStale]: fieldPath('errors', 'serviceStale'),
  [ERRORS.serviceSharedUnacknowledged]: fieldPath('errors', 'serviceSharedUnacknowledged'),
  [ERRORS.serviceImpactUnresolved]: fieldPath('errors', 'serviceImpactUnresolved'),
  [ERRORS.serviceAlreadyOffered]: fieldPath('errors', 'serviceAlreadyOffered'),
  [ERRORS.resourceStale]: fieldPath('errors', 'resourceStale'),
  [ERRORS.resourceImpactUnacknowledged]: fieldPath('errors', 'resourceImpactUnacknowledged'),
  [ERRORS.employeeAlreadySetUp]: fieldPath('team', 'errors', 'alreadySetUp'),
  [VALIDATION.dateRangeInvalid]: fieldPath('validation', 'dateRangeInvalid'),
  [VALIDATION.dateRangeTooLong]: fieldPath('validation', 'dateRangeTooLong'),
  [VALIDATION.durationInvalid]: fieldPath('validation', 'durationInvalid'),
  [VALIDATION.bufferInvalid]: fieldPath('validation', 'bufferInvalid'),
  [VALIDATION.slotIntervalInvalid]: fieldPath('validation', 'slotIntervalInvalid'),
  [VALIDATION.noticeInvalid]: fieldPath('validation', 'noticeInvalid'),
  [VALIDATION.horizonInvalid]: fieldPath('validation', 'horizonInvalid'),
  [VALIDATION.requirementCountInvalid]: fieldPath('validation', 'requirementCountInvalid'),
  [VALIDATION.tooMany]: fieldPath('validation', 'tooMany'),
  [VALIDATION.fieldRequired]: fieldPath('validation', 'fieldRequired'),
  [VALIDATION.idInvalid]: fieldPath('validation', 'idInvalid'),
  [VALIDATION.referenceInvalid]: fieldPath('validation', 'referenceInvalid'),
  [VALIDATION.startInvalid]: fieldPath('validation', 'startInvalid'),
  [VALIDATION.emailInvalid]: fieldPath('validation', 'emailInvalid'),
  [VALIDATION.limitInvalid]: fieldPath('validation', 'limitInvalid'),
  [VALIDATION.nameInvalid]: fieldPath('validation', 'nameInvalid'),
  [VALIDATION.addressInvalid]: fieldPath('validation', 'addressInvalid'),
  [VALIDATION.timeZoneInvalid]: fieldPath('validation', 'timeZoneInvalid'),
  [VALIDATION.weekInvalid]: fieldPath('validation', 'weekInvalid'),
  [VALIDATION.timeRangeInvalid]: fieldPath('validation', 'timeRangeInvalid'),
  [VALIDATION.timeRangesOverlap]: fieldPath('validation', 'timeRangesOverlap'),
  [VALIDATION.breakOutsideHours]: fieldPath('validation', 'breakOutsideHours'),
  [VALIDATION.exceptionInvalid]: fieldPath('validation', 'exceptionInvalid'),
  [VALIDATION.exceptionsOverlap]: fieldPath('validation', 'exceptionsOverlap'),
  [VALIDATION.coverageOverlap]: fieldPath('validation', 'coverageOverlap'),
  [VALIDATION.categoryInvalid]: fieldPath('validation', 'categoryInvalid'),
  [VALIDATION.descriptionInvalid]: fieldPath('validation', 'descriptionInvalid'),
  [VALIDATION.documentsInvalid]: fieldPath('validation', 'documentsInvalid'),
  [VALIDATION.instructionsInvalid]: fieldPath('validation', 'instructionsInvalid'),
  [VALIDATION.noteInvalid]: fieldPath('validation', 'noteInvalid'),
  [VALIDATION.actorsRequired]: fieldPath('validation', 'actorsRequired'),
  [VALIDATION.noticeNotBeforeHorizon]: fieldPath('validation', 'noticeNotBeforeHorizon'),
  [VALIDATION.deadlineInvalid]: fieldPath('validation', 'deadlineInvalid'),
  [VALIDATION.resourceInvalid]: fieldPath('validation', 'resourceInvalid'),
  [VALIDATION.qualificationInvalid]: fieldPath('validation', 'qualificationInvalid'),
  [VALIDATION.adoptModeInvalid]: fieldPath('validation', 'adoptModeInvalid'),
  [VALIDATION.resourceTypeInvalid]: fieldPath('validation', 'resourceTypeInvalid'),
  [VALIDATION.capacityInvalid]: fieldPath('validation', 'capacityInvalid'),
  [VALIDATION.locationInvalid]: fieldPath('validation', 'locationInvalid'),
  [VALIDATION.serviceInvalid]: fieldPath('validation', 'serviceInvalid'),
  [VALIDATION.hoursOutsideLocation]: fieldPath('team', 'validation', 'hoursOutsideLocation'),
} as const satisfies Record<BookingCode, ValidKeys>;

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('errors', 'unexpected');

export type MessageKey =
  (typeof MESSAGE_KEY_BY_CODE)[BookingCode] | typeof GENERIC_ERROR_MESSAGE_KEY;

function isBookingCode(code: string): code is BookingCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

/**
 * Codes from other modules (authorization, for instance) or from Zod's own structural messages are
 * unknown here and get the generic message.
 */
export function messageKeyForCode(code: string): MessageKey {
  return isBookingCode(code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}

/**
 * What a booking is called on a screen: its status, except that a confirmed booking is told apart by
 * whether an employee still has to take it. "Open" and "assigned" are not statuses of their own
 * (BD-04); the view's `assignment` says which.
 */
export type BookingDisplayState =
  Exclude<BookingDto['status'], 'confirmed'> | BookingDto['assignment'];

export const STATUS_MESSAGE_KEYS = {
  held: fieldPath('status', 'held'),
  open: fieldPath('status', 'open'),
  assigned: fieldPath('status', 'assigned'),
  completed: fieldPath('status', 'completed'),
  cancelled: fieldPath('status', 'cancelled'),
  no_show: fieldPath('status', 'noShow'),
  expired: fieldPath('status', 'expired'),
} as const satisfies Record<BookingDisplayState, ValidKeys>;

/** Interpolation values for messages that mention a limit. */
export const MESSAGE_PARAMS = {
  nameMax: LOCATION_LIMITS.nameMax,
  addressMax: LOCATION_LIMITS.addressMax,
  descriptionMax: SERVICE_LIMITS.descriptionMax,
  categoryMax: SERVICE_LIMITS.categoryMax,
  documentMax: SERVICE_LIMITS.documentMax,
  documentsMax: SERVICE_LIMITS.documentsMax,
  instructionsMax: SERVICE_LIMITS.instructionsMax,
  noteMax: SERVICE_LIMITS.noteMax,
  resourcesMax: SERVICE_LIMITS.resourcesMax,
} as const;

export const HOLIDAY_MESSAGE_KEYS = {
  newYear: fieldPath('holidays', 'newYear'),
  epiphany: fieldPath('holidays', 'epiphany'),
  womensDay: fieldPath('holidays', 'womensDay'),
  goodFriday: fieldPath('holidays', 'goodFriday'),
  easterSunday: fieldPath('holidays', 'easterSunday'),
  easterMonday: fieldPath('holidays', 'easterMonday'),
  labourDay: fieldPath('holidays', 'labourDay'),
  ascension: fieldPath('holidays', 'ascension'),
  whitSunday: fieldPath('holidays', 'whitSunday'),
  whitMonday: fieldPath('holidays', 'whitMonday'),
  corpusChristi: fieldPath('holidays', 'corpusChristi'),
  assumption: fieldPath('holidays', 'assumption'),
  germanUnity: fieldPath('holidays', 'germanUnity'),
  childrensDay: fieldPath('holidays', 'childrensDay'),
  reformationDay: fieldPath('holidays', 'reformationDay'),
  allSaints: fieldPath('holidays', 'allSaints'),
  repentanceDay: fieldPath('holidays', 'repentanceDay'),
  christmasDay: fieldPath('holidays', 'christmasDay'),
  boxingDay: fieldPath('holidays', 'boxingDay'),
} as const satisfies Record<HolidayKey, ValidKeys>;

export const REGION_MESSAGE_KEYS = {
  DE: fieldPath('regions', 'DE'),
  BW: fieldPath('regions', 'BW'),
  BY: fieldPath('regions', 'BY'),
  BE: fieldPath('regions', 'BE'),
  BB: fieldPath('regions', 'BB'),
  HB: fieldPath('regions', 'HB'),
  HH: fieldPath('regions', 'HH'),
  HE: fieldPath('regions', 'HE'),
  MV: fieldPath('regions', 'MV'),
  NI: fieldPath('regions', 'NI'),
  NW: fieldPath('regions', 'NW'),
  RP: fieldPath('regions', 'RP'),
  SL: fieldPath('regions', 'SL'),
  SN: fieldPath('regions', 'SN'),
  ST: fieldPath('regions', 'ST'),
  SH: fieldPath('regions', 'SH'),
  TH: fieldPath('regions', 'TH'),
} as const satisfies Record<GermanRegion, ValidKeys>;

export const EXCEPTION_KIND_MESSAGE_KEYS = {
  closed: fieldPath('exceptions', 'kind', 'closed'),
  override: fieldPath('exceptions', 'kind', 'override'),
  additional: fieldPath('exceptions', 'kind', 'additional'),
} as const satisfies Record<ExceptionKind, ValidKeys>;

export const WEEK_TEMPLATE_MESSAGE_KEYS = {
  standardOffice: fieldPath('hours', 'templates', 'standardOffice'),
  mornings: fieldPath('hours', 'templates', 'mornings'),
  extended: fieldPath('hours', 'templates', 'extended'),
  closed: fieldPath('hours', 'templates', 'closed'),
} as const satisfies Record<WeekTemplateKey, ValidKeys>;

export const IMPACT_REASON_MESSAGE_KEYS = {
  'outside-opening-hours': fieldPath('impact', 'reason', 'outsideOpeningHours'),
  'resource-unavailable': fieldPath('impact', 'reason', 'resourceUnavailable'),
  'over-capacity': fieldPath('impact', 'reason', 'overCapacity'),
} as const satisfies Record<AffectedBookingDto['reason'], ValidKeys>;

/** Who may cancel and change a booking, as the messages name them. */
export const ACTOR_MESSAGE_KEYS = {
  customer: fieldPath('services', 'rules', 'actors', 'customer'),
  employee: fieldPath('services', 'rules', 'actors', 'employee'),
  manager: fieldPath('services', 'rules', 'actors', 'manager'),
} as const satisfies Record<ChangeActor, ValidKeys>;

/** What a resource is, as the messages name each kind. */
export const RESOURCE_TYPE_MESSAGE_KEYS = {
  employee: fieldPath('services', 'resourceTypes', 'employee'),
  room: fieldPath('services', 'resourceTypes', 'room'),
  office: fieldPath('services', 'resourceTypes', 'office'),
  'service-desk': fieldPath('services', 'resourceTypes', 'serviceDesk'),
  'sports-field': fieldPath('services', 'resourceTypes', 'sportsField'),
  'meeting-room': fieldPath('services', 'resourceTypes', 'meetingRoom'),
  vehicle: fieldPath('services', 'resourceTypes', 'vehicle'),
  equipment: fieldPath('services', 'resourceTypes', 'equipment'),
  facility: fieldPath('services', 'resourceTypes', 'facility'),
  workstation: fieldPath('services', 'resourceTypes', 'workstation'),
  other: fieldPath('services', 'resourceTypes', 'other'),
} as const satisfies Record<ResourceKind, ValidKeys>;

type Fit = AssignmentCandidatesDto['eligible'][number]['fit']['level'];
type Reason = AssignmentCandidatesDto['unavailable'][number]['reasons'][number]['code'];

/** How well a candidate fits, as the assignment dialog says it. */
export const FIT_MESSAGE_KEYS = {
  'very-good': fieldPath('bookings', 'assign', 'fit', 'veryGood'),
  good: fieldPath('bookings', 'assign', 'fit', 'good'),
  possible: fieldPath('bookings', 'assign', 'fit', 'possible'),
} as const satisfies Record<Fit, ValidKeys>;

/** Why somebody cannot take a booking, one sentence per reason code of the domain. */
export const REASON_MESSAGE_KEYS = {
  'booking-not-assignable': fieldPath('bookings', 'assign', 'reasons', 'bookingNotAssignable'),
  'booking-over': fieldPath('bookings', 'assign', 'reasons', 'bookingOver'),
  'resource-inactive': fieldPath('bookings', 'assign', 'reasons', 'resourceInactive'),
  'wrong-resource-type': fieldPath('bookings', 'assign', 'reasons', 'wrongResourceType'),
  'missing-qualification': fieldPath('bookings', 'assign', 'reasons', 'missingQualification'),
  'wrong-location': fieldPath('bookings', 'assign', 'reasons', 'wrongLocation'),
  'not-in-pinned-pool': fieldPath('bookings', 'assign', 'reasons', 'notInPinnedPool'),
  'already-on-booking': fieldPath('bookings', 'assign', 'reasons', 'alreadyOnBooking'),
  'outside-working-hours': fieldPath('bookings', 'assign', 'reasons', 'outsideWorkingHours'),
  'time-conflict': fieldPath('bookings', 'assign', 'reasons', 'timeConflict'),
} as const satisfies Record<Reason, ValidKeys>;
