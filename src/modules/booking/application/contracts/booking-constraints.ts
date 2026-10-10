/**
 * The validation limits forms need, re-exported so presentation reads them
 * from the application contract instead of reaching into the domain.
 */
export { AVAILABILITY_LIMITS } from '../../domain/models/availability-plan';
export { RESOURCE_LIMITS, RESOURCE_TYPES } from '../../domain/models/bookable-resource';
export {
  CHANGE_ACTORS,
  INFORMATION_FIELDS,
  SERVICE_LIMITS,
} from '../../domain/models/bookable-service';
export { CUSTOMER_LIMITS } from '../../domain/models/booking-customer';
export { LOCATION_LIMITS } from '../../domain/models/booking-location';
export { BOOKING_REFERENCE_LENGTH } from '../../domain/models/booking-reference';
export { BOOKING_STATUSES } from '../../domain/models/booking';
export { EXCEPTION_KINDS } from '../../domain/models/availability-plan';
export {
  ALTERNATIVE_SEARCH_DAYS,
  DEFAULT_ALTERNATIVE_COUNT,
  HOLD_MINUTES,
  MAX_ALTERNATIVE_COUNT,
  MAX_AVAILABILITY_RANGE_DAYS,
  MAX_CALENDAR_RANGE_DAYS,
} from '../booking-limits';
export type { ChangeActor, InformationField } from '../../domain/models/bookable-service';
export type { ResourceKind } from '../../domain/models/bookable-resource';
export type { BookingStatus } from '../../domain/models/booking';
export type { LocalDate, Weekday } from '../../domain/time/local-date';
export type { TimeZone } from '../../domain/time/time-zone';

/**
 * Calendar arithmetic the screens need. These are pure functions over plain
 * values: a `LocalDate` is a calendar day with no zone, and the zone-aware
 * ones take the location's zone explicitly, so a browser in another country
 * still shows the wall-clock time of the place.
 */
export {
  WEEKDAYS,
  addDays,
  compareLocalDates,
  createLocalDate,
  formatLocalDate,
  fromEpochDay,
  isSameLocalDate,
  parseLocalDate,
  toEpochDay,
  weekdayOf,
} from '../../domain/time/local-date';
export { formatTimeOfDay, parseTimeOfDay, MINUTES_PER_DAY } from '../../domain/time/time-of-day';
export { epochToZonedWallClock, localDateOf, parseTimeZone } from '../../domain/time/time-zone';
export { BOOKING_ERROR_CODES, BOOKING_VALIDATION_CODES } from '../../domain/errors/booking-errors';
export type { BookingCode } from '../../domain/errors/booking-errors';
export { MAX_CUSTOMER_RESCHEDULES } from '../../domain/policies/change-policy';
export type { LimitedAction } from '../../domain/ports/request-limiter.port';
