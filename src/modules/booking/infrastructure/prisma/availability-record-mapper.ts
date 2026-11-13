import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { arrayOf, isString, objectOf, oneOf, optional } from '@lib/utils';

import { bookingDataInvalid } from '../../domain/errors/booking-errors';
import { EXCEPTION_KINDS } from '../../domain/scheduling/availability-plan';
import { CLOSED_DAY, WEEKDAYS, createTimeRange } from '../../domain/scheduling/weekly-hours';
import { formatLocalDate, parseLocalDate, toEpochDay } from '../../domain/time/local-date';
import { formatTimeOfDay, parseTimeOfDay } from '../../domain/time/time-of-day';

import type {
  AvailabilityException,
  AvailabilityPlan,
  ExceptionKind,
} from '../../domain/scheduling/availability-plan';
import type { DaySchedule, TimeRange, WeeklyHours } from '../../domain/scheduling/weekly-hours';

/**
 * The stored shape of opening hours and working hours, as the first version of the module wrote it
 * and as the seed writes it: a week, Monday first, of ranges and breaks as `HH:mm` text, and dated
 * exceptions. The administration (P06, P08) may change what it writes; this reader is the one
 * place that knows the shape.
 */
interface StoredRange {
  readonly start: string;
  readonly end: string;
}

interface StoredDay {
  readonly intervals: StoredRange[];
  readonly breaks: StoredRange[];
}

interface StoredException {
  readonly kind: ExceptionKind;
  readonly from: string;
  readonly to: string;
  readonly day?: StoredDay | undefined;
}

interface StoredPlan {
  readonly weekly: StoredDay[];
  readonly exceptions: StoredException[];
}

const isStoredRange = objectOf<StoredRange>({ start: isString, end: isString });
const isStoredDay = objectOf<StoredDay>({
  intervals: arrayOf(isStoredRange),
  breaks: arrayOf(isStoredRange),
});
const isStoredException = objectOf<StoredException>({
  kind: oneOf(EXCEPTION_KINDS),
  from: isString,
  to: isString,
  day: optional(isStoredDay),
});
const isStoredPlan = objectOf<StoredPlan>({
  weekly: arrayOf(isStoredDay),
  exceptions: arrayOf(isStoredException),
});

const DAYS_PER_WEEK = 7;

function readRange({ start, end }: StoredRange): TimeRange | null {
  const startMinute = parseTimeOfDay(start);
  const endMinute = parseTimeOfDay(end);
  return startMinute === null || endMinute === null
    ? null
    : createTimeRange(startMinute, endMinute);
}

function readRanges(stored: readonly StoredRange[]): TimeRange[] | null {
  const ranges = stored.map(readRange);
  return ranges.every((range) => range !== null) ? ranges : null;
}

function readDay(stored: StoredDay): DaySchedule | null {
  const ranges = readRanges(stored.intervals);
  const breaks = readRanges(stored.breaks);
  return ranges === null || breaks === null ? null : { ranges, breaks };
}

function readException(stored: StoredException): AvailabilityException | null {
  const from = parseLocalDate(stored.from);
  const to = parseLocalDate(stored.to);
  const day = stored.kind === 'closed' ? CLOSED_DAY : stored.day && readDay(stored.day);
  if (from === null || to === null || toEpochDay(from) > toEpochDay(to) || !day) {
    return null;
  }
  return { kind: stored.kind, from, to, day };
}

function readWeek(stored: readonly StoredDay[]): WeeklyHours | null {
  const days = stored.map(readDay);
  if (days.length !== DAYS_PER_WEEK || !days.every((day) => day !== null)) {
    return null;
  }
  const [monday, tuesday, wednesday, thursday, friday, saturday, sunday] = days;
  return monday && tuesday && wednesday && thursday && friday && saturday && sunday
    ? { 1: monday, 2: tuesday, 3: wednesday, 4: thursday, 5: friday, 6: saturday, 7: sunday }
    : null;
}

/** A stored plan as the rules read it, or a persistence failure when it is not in the shape above. */
export function readAvailability(
  raw: unknown,
): AppResult<AvailabilityPlan, InfrastructureAppError> {
  if (!isStoredPlan(raw)) {
    return err(bookingDataInvalid('availability'));
  }
  const weekly = readWeek(raw.weekly);
  const exceptions = raw.exceptions.map(readException);
  if (weekly === null || !exceptions.every((exception) => exception !== null)) {
    return err(bookingDataInvalid('availability'));
  }
  return ok({ weekly, exceptions });
}

/** `null` stays `null`: a service or a resource without a plan of its own. */
export function readOptionalAvailability(
  raw: unknown,
): AppResult<AvailabilityPlan | null, InfrastructureAppError> {
  return raw === null ? ok(null) : readAvailability(raw);
}

function writeRange({ startMinute, endMinute }: TimeRange): StoredRange {
  return { start: formatTimeOfDay(startMinute), end: formatTimeOfDay(endMinute) };
}

function writeDay({ ranges, breaks }: DaySchedule): StoredDay {
  return { intervals: ranges.map(writeRange), breaks: breaks.map(writeRange) };
}

/**
 * A plan in the stored shape, the inverse of `readAvailability`: the week Monday first, the
 * exceptions with their dates as `YYYY-MM-DD`. A closed exception stores no hours.
 */
export function writeAvailability(plan: AvailabilityPlan): StoredPlan {
  return {
    weekly: WEEKDAYS.map((weekday) => writeDay(plan.weekly[weekday])),
    exceptions: plan.exceptions.map((exception) => ({
      kind: exception.kind,
      from: formatLocalDate(exception.from),
      to: formatLocalDate(exception.to),
      ...(exception.kind === 'closed' ? {} : { day: writeDay(exception.day) }),
    })),
  };
}
