/**
 * The bounds on what a request may carry, and the domain vocabulary the boundary checks it against,
 * defined once: presentation reads them here (it never imports the domain itself), so a number or a
 * code is never typed twice. The limits cap the size of untrusted text; the rules about what a
 * booking may contain (which details a service asks for) are the domain's.
 */
export { BOOKING_ERROR_CODES, BOOKING_VALIDATION_CODES } from '../../domain/errors/booking-errors';
export { INFORMATION_FIELDS } from '../../domain/models/bookable-service';
export { BOOKING_STATUSES } from '../../domain/models/booking';
export { LOCATION_PAGE_LIMITS, RESOURCE_PAGE_LIMITS, SERVICE_PAGE_LIMITS } from '../booking-limits';
export { BOOKING_ID_MAX_LENGTH } from '../../domain/models/ids';
export type { InformationField } from '../../domain/models/bookable-service';
export type { BookingCustomer } from '../../domain/models/booking';

export const BOOKING_INPUT_LIMITS = {
  /** A request key the caller names an attempt with. */
  requestKeyMax: 128,
  nameMax: 120,
  emailMax: 254,
  phoneMax: 50,
  referenceNumberMax: 100,
  notesMax: 2000,
  /** What a reference may be typed as (spaces and lower case are tolerated and removed). */
  referenceMax: 32,
  /** Most requirements a service has (`SCHEDULING_LIMITS.maxRequirements`) minus one: the highest index. */
  requirementIndexMax: 5,
  /** Longest text of an ISO-8601 instant with its offset and milliseconds. */
  instantMax: 40,
} as const;

export { EXCEPTION_KINDS } from '../../domain/scheduling/availability-plan';
export {
  GERMAN_REGIONS,
  HOLIDAY_KEYS,
  holidayKeysOn,
  publicHolidaysOf,
} from '../../domain/holidays/german-holidays';
export type { ExceptionKind } from '../../domain/scheduling/availability-plan';
export type {
  GermanRegion,
  HolidayKey,
  PublicHoliday,
} from '../../domain/holidays/german-holidays';

/** The bounds on what the administration of a location may carry. */
export const LOCATION_LIMITS = {
  nameMax: 120,
  addressMax: 300,
  searchMax: 100,
  /** Open ranges and breaks one day may have. */
  rangesPerDayMax: 6,
  /** Dated exceptions one location may have: a few years of holidays and closures. */
  exceptionsMax: 500,
  /** The longest run of days one exception covers. */
  exceptionDaysMax: 366,
  /** Wall-clock text, `HH:mm`. */
  timeMax: 5,
  /** Calendar-day text, `YYYY-MM-DD`. */
  dayMax: 10,
  /** Longest IANA zone name (`schema.prisma`: `BookingLocation_zone_rule`). */
  zoneMax: 64,
  /** Longest text of a version token (an ISO-8601 instant with milliseconds). */
  versionMax: 40,
} as const;

/**
 * The rules a form is checked against in the browser are the ones the server checks: the same
 * function reads the same input, so a message the form shows is the message the use case would
 * have refused with, at the same field. The server stays the boundary.
 */
export { parseLocationInput } from '../services/parse-location-input';
export { parseResourceInput } from '../services/parse-resource-input';
export { MAX_COVERAGE_SPELLS } from '../../domain/models/employee-coverage';
export { parseCoverage } from '../services/parse-coverage';
export { parseEmployeeCalendar } from '../services/parse-employee-calendar';

export { CHANGE_ACTORS } from '../../domain/models/bookable-service';
export { RESOURCE_TYPES } from '../../domain/models/bookable-resource';
export { SLOT_RULE_LIMITS } from '../../domain/scheduling/slot-rules';
export { MAX_HORIZON_DAYS } from '../../domain/scheduling/start-window';
export { MAX_MINUTES } from '../../domain/time/minutes';
export type { ChangeActor } from '../../domain/models/bookable-service';
export type { ResourceKind } from '../../domain/models/bookable-resource';

/** The bounds on what the administration of a service may carry (`BookableService_*_rule` in the schema). */
export const SERVICE_LIMITS = {
  nameMax: 120,
  descriptionMax: 2000,
  categoryMax: 64,
  /** One short item of the list of documents to bring. */
  documentMax: 120,
  documentsMax: 20,
  instructionsMax: 2000,
  noteMax: 2000,
  searchMax: 100,
  /** One skill key: a qualification. */
  qualificationMax: 64,
  /** Physical resources one service may name at a location: the engine allows six requirements and one is the employee. */
  resourcesMax: 5,
  /** The grid starts are offered on when a service is made here; the form has no field for it. */
  defaultStepMinutes: 15,
  /** Services or resources one list answer carries. */
  listMax: 500,
} as const;

/** What a person can choose to do with an adopted service. */
export const ADOPT_MODES = ['copy', 'link'] as const;
export type AdoptMode = (typeof ADOPT_MODES)[number];

/** Whether closing a service reaches this location only or every location that has it. */
export const DEACTIVATION_SCOPES = ['location', 'all'] as const;
export type DeactivationScope = (typeof DEACTIVATION_SCOPES)[number];

/** What a manager decides for a booking of a service that is closed. */
export const SERVICE_RESOLUTIONS = ['leave', 'cancel'] as const;
export type ServiceResolution = (typeof SERVICE_RESOLUTIONS)[number];

/** Who the employee of a service is: nobody (a resource reservation), anyone, or someone with a qualification. */
export const EMPLOYEE_NEEDS = ['none', 'any', 'qualified'] as const;
export type EmployeeNeed = (typeof EMPLOYEE_NEEDS)[number];

/** What closing a service does to the bookings it has: nothing, or each is decided. */
export const DEACTIVATION_MODES = ['block-new', 'review'] as const;
export type DeactivationMode = (typeof DEACTIVATION_MODES)[number];

/** Where a service stands at a location, for the filters of the list. */
export const SERVICE_ORIGINS = ['own', 'copy', 'linked'] as const;
export type ServiceOriginKind = (typeof SERVICE_ORIGINS)[number];

/** The same rules the use case applies, run by the form: the message it shows is the one the server would refuse with. */
export { parseServiceInput } from '../services/parse-service-input';

/** The bounds on what the administration of a resource may carry (`BookableResource_*_rule` in the schema). */
export const RESOURCE_LIMITS = {
  nameMax: 120,
  noteMax: 2000,
  capacityMin: 1,
  capacityMax: 10_000,
  searchMax: 100,
} as const;
