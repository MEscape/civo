import type { FieldErrorBag, ValidationAppError } from '@lib/errors';
import { ok, err } from '@lib/result';
import type { AppResult } from '@lib/result';

import { BOOKING_VALIDATION_CODES as CODES, createBookingErrorBag } from '../errors/booking-errors';
import {
  WEEKDAYS,
  compareLocalDates,
  daysBetween,
  formatLocalDate,
  parseLocalDate,
} from '../time/local-date';
import { MINUTES_PER_DAY, formatTimeOfDay, parseTimeOfDay } from '../time/time-of-day';

import type { LocalDate, Weekday } from '../time/local-date';

export const AVAILABILITY_LIMITS = {
  maxRangesPerDay: 8,
  maxBreaksPerDay: 8,
  maxExceptions: 200,
  maxLabelLength: 80,
  /** An exception covers at most a year; a longer closure is entered as several. */
  maxExceptionDays: 366,
} as const;

/** `[startMinute, endMinute)` after local midnight; the end may be 1440 (midnight). */
export interface TimeRange {
  readonly startMinute: number;
  readonly endMinute: number;
}

/**
 * One day's working time as the editor thinks of it: when the place or the
 * person works, and the breaks inside it. Breaks are subtracted, never
 * implied: 08:00-17:00 with a 12:00-13:00 break is two bookable windows.
 */
export interface DaySchedule {
  readonly intervals: readonly TimeRange[];
  readonly breaks: readonly TimeRange[];
}

/** The seven days of a week, keyed by ISO weekday. */
export type WeeklySchedule = Readonly<Record<Weekday, DaySchedule>>;

/**
 * - `closed`: nobody is available (holiday, vacation, absence, closure). Always wins.
 * - `override`: the day's hours are these instead of the weekly ones (a one-off schedule change).
 * - `additional`: these hours are available on top of the weekly ones (one-off availability).
 */
export const EXCEPTION_KINDS = ['closed', 'override', 'additional'] as const;
export type ExceptionKind = (typeof EXCEPTION_KINDS)[number];

export interface AvailabilityException {
  readonly kind: ExceptionKind;
  /** First day covered. */
  readonly from: LocalDate;
  /** Last day covered, included. */
  readonly to: LocalDate;
  /** Empty for `closed`. */
  readonly day: DaySchedule;
  readonly label: string | null;
}

/**
 * When a place, a person or a service can be booked: a weekly pattern plus
 * dated exceptions. The same shape serves a location's opening hours, an
 * employee's working schedule and a service's own restrictions, so there is
 * one place where "is it available on this day" is decided.
 */
export interface AvailabilityPlan {
  readonly weekly: WeeklySchedule;
  readonly exceptions: readonly AvailabilityException[];
}

export const NO_HOURS: DaySchedule = { intervals: [], breaks: [] };

/** The seven days from a Monday-first list; a missing entry is a day without hours. */
function toWeekly(days: readonly DaySchedule[]): WeeklySchedule {
  const [monday, tuesday, wednesday, thursday, friday, saturday, sunday] = WEEKDAYS;
  const [first, second, third, fourth, fifth, sixth, seventh] = days;
  return {
    [monday]: first ?? NO_HOURS,
    [tuesday]: second ?? NO_HOURS,
    [wednesday]: third ?? NO_HOURS,
    [thursday]: fourth ?? NO_HOURS,
    [friday]: fifth ?? NO_HOURS,
    [saturday]: sixth ?? NO_HOURS,
    [sunday]: seventh ?? NO_HOURS,
  };
}

export interface TimeRangeInput {
  /** `HH:mm`. */
  readonly start: string;
  /** `HH:mm`; `24:00` is midnight. */
  readonly end: string;
}

export interface DayScheduleInput {
  readonly intervals: readonly TimeRangeInput[];
  readonly breaks: readonly TimeRangeInput[];
}

export interface AvailabilityExceptionInput {
  readonly kind: string;
  /** `YYYY-MM-DD`. */
  readonly from: string;
  /** `YYYY-MM-DD`, included. */
  readonly to: string;
  readonly day?: DayScheduleInput | undefined;
  readonly label?: string | null | undefined;
}

const NO_HOURS_INPUT: DayScheduleInput = { intervals: [], breaks: [] };

export interface AvailabilityPlanInput {
  /** Seven entries, Monday first. */
  readonly weekly: readonly DayScheduleInput[];
  readonly exceptions: readonly AvailabilityExceptionInput[];
}

function parseRange(input: TimeRangeInput, path: string, bag: FieldErrorBag): TimeRange | null {
  const startMinute = parseTimeOfDay(input.start);
  const endMinute = parseTimeOfDay(input.end);
  if (
    startMinute === null ||
    endMinute === null ||
    startMinute >= MINUTES_PER_DAY ||
    endMinute <= startMinute
  ) {
    bag.add(path, CODES.timeRangeInvalid);
    return null;
  }
  return { startMinute, endMinute };
}

/** Parses the ranges of one list; ranges that overlap are an error, ranges that touch are fine. */
function parseRanges(
  inputs: readonly TimeRangeInput[],
  { path, max }: { readonly path: string; readonly max: number },
  bag: FieldErrorBag,
): TimeRange[] {
  if (inputs.length > max) {
    bag.add(path, CODES.tooMany);
    return [];
  }
  const parsed = inputs.flatMap((input, index) => {
    const range = parseRange(input, `${path}.${index}`, bag);
    return range === null ? [] : [range];
  });
  const sorted = [...parsed].sort((a, b) => a.startMinute - b.startMinute);
  sorted.forEach((range, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && range.startMinute < previous.endMinute) {
      bag.add(path, CODES.timeRangesOverlap);
    }
  });
  return sorted;
}

function parseDay(input: DayScheduleInput, path: string, bag: FieldErrorBag): DaySchedule {
  return {
    intervals: parseRanges(
      input.intervals,
      { path: `${path}.intervals`, max: AVAILABILITY_LIMITS.maxRangesPerDay },
      bag,
    ),
    breaks: parseRanges(
      input.breaks,
      { path: `${path}.breaks`, max: AVAILABILITY_LIMITS.maxBreaksPerDay },
      bag,
    ),
  };
}

function parseExceptionKind(raw: string): ExceptionKind | null {
  return EXCEPTION_KINDS.find((kind) => kind === raw) ?? null;
}

function checkExceptionRange(
  { from, to }: { readonly from: LocalDate; readonly to: LocalDate },
  path: string,
  bag: FieldErrorBag,
): boolean {
  if (compareLocalDates(from, to) > 0) {
    return bag.expect(false, `${path}.to`, CODES.dateRangeInvalid);
  }
  const isShortEnough = daysBetween(from, to) + 1 <= AVAILABILITY_LIMITS.maxExceptionDays;
  return bag.expect(isShortEnough, `${path}.to`, CODES.dateRangeTooLong);
}

interface ExceptionFields {
  readonly kind: ExceptionKind;
  readonly from: LocalDate;
  readonly to: LocalDate;
}

/** The kind and dates of an exception, with every missing or unreadable one reported at once. */
function parseExceptionFields(
  input: AvailabilityExceptionInput,
  path: string,
  bag: FieldErrorBag,
): ExceptionFields | null {
  const kind = parseExceptionKind(input.kind);
  const from = parseLocalDate(input.from);
  const to = parseLocalDate(input.to);
  const hasValidFields = [
    bag.expect(kind !== null, `${path}.kind`, CODES.exceptionKindUnknown),
    bag.expect(from !== null, `${path}.from`, CODES.dateInvalid),
    bag.expect(to !== null, `${path}.to`, CODES.dateInvalid),
  ].every(Boolean);
  return hasValidFields && kind !== null && from !== null && to !== null
    ? { kind, from, to }
    : null;
}

function parseException(
  input: AvailabilityExceptionInput,
  path: string,
  bag: FieldErrorBag,
): AvailabilityException | null {
  const fields = parseExceptionFields(input, path, bag);
  if (fields === null) {
    return null;
  }
  const { kind, from, to } = fields;

  const isRangeValid = checkExceptionRange({ from, to }, path, bag);

  const label = input.label?.trim() ?? '';
  const isLabelValid = bag.expect(
    label.length <= AVAILABILITY_LIMITS.maxLabelLength,
    `${path}.label`,
    CODES.textTooLong,
  );

  const day =
    kind === 'closed' ? NO_HOURS : parseDay(input.day ?? NO_HOURS_INPUT, `${path}.day`, bag);
  const hasHours = bag.expect(
    kind === 'closed' || day.intervals.length > 0,
    `${path}.day.intervals`,
    CODES.timeRangeInvalid,
  );

  return isRangeValid && isLabelValid && hasHours
    ? { kind, from, to, day, label: label === '' ? null : label }
    : null;
}

/**
 * Builds a plan from editor input, collecting every problem in one pass so a
 * form can show them all. The domain invariants hold afterwards: ranges are
 * real, sorted and non-overlapping, dates exist, and an exception that
 * changes hours actually has some.
 */
export function createAvailabilityPlan(
  input: AvailabilityPlanInput,
  path = 'availability',
): AppResult<AvailabilityPlan, ValidationAppError> {
  const bag = createBookingErrorBag();

  if (input.weekly.length !== WEEKDAYS.length) {
    bag.add(`${path}.weekly`, CODES.timeRangeInvalid);
    return err(bag.toError());
  }
  const days = input.weekly.map((day, index) => parseDay(day, `${path}.weekly.${index}`, bag));

  if (input.exceptions.length > AVAILABILITY_LIMITS.maxExceptions) {
    bag.add(`${path}.exceptions`, CODES.tooMany);
  }
  const exceptions = input.exceptions
    .slice(0, AVAILABILITY_LIMITS.maxExceptions)
    .flatMap((exception, index) => {
      const parsed = parseException(exception, `${path}.exceptions.${index}`, bag);
      return parsed === null ? [] : [parsed];
    });

  return bag.hasErrors ? err(bag.toError()) : ok({ weekly: toWeekly(days), exceptions });
}

function toRangeInput(range: TimeRange): TimeRangeInput {
  return { start: formatTimeOfDay(range.startMinute), end: formatTimeOfDay(range.endMinute) };
}

function toDayInput(day: DaySchedule): DayScheduleInput {
  return { intervals: day.intervals.map(toRangeInput), breaks: day.breaks.map(toRangeInput) };
}

/**
 * The editor's form of a stored plan: the inverse of `createAvailabilityPlan`,
 * so what an editor loads is exactly what it can submit again.
 */
export function toAvailabilityPlanInput(plan: AvailabilityPlan): AvailabilityPlanInput {
  return {
    weekly: WEEKDAYS.map((weekday) => toDayInput(plan.weekly[weekday])),
    exceptions: plan.exceptions.map((exception) => ({
      kind: exception.kind,
      from: formatLocalDate(exception.from),
      to: formatLocalDate(exception.to),
      day: toDayInput(exception.day),
      label: exception.label,
    })),
  };
}
