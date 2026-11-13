import { isDefined } from '@lib/utils';

import { weekdayOf } from '../time/local-date';
import { datesOf } from '../time/local-date-range';
import { firstInstantReading } from '../time/local-time-resolution';
import { mergeIntervals, subtractIntervals, createInterval } from '../time/time-interval';
import { MINUTES_PER_DAY } from '../time/time-of-day';

import type { LocalDate, Weekday } from '../time/local-date';
import type { LocalDateRange } from '../time/local-date-range';
import type { TimeInterval } from '../time/time-interval';
import type { TimeZone } from '../time/time-zone';

/** `[startMinute, endMinute)` after local midnight; the end may be 1440 (midnight). */
export interface TimeRange {
  readonly startMinute: number;
  readonly endMinute: number;
}

/** `null` unless the range is whole minutes, non-empty and inside one day. */
export function createTimeRange(startMinute: number, endMinute: number): TimeRange | null {
  const isValid =
    Number.isInteger(startMinute) &&
    Number.isInteger(endMinute) &&
    startMinute >= 0 &&
    startMinute < endMinute &&
    endMinute <= MINUTES_PER_DAY;
  return isValid ? { startMinute, endMinute } : null;
}

/**
 * One day's working time as the editor thinks of it: when the place or the person works, and the
 * breaks inside it. Breaks are subtracted, never implied: 08:00-17:00 with a 12:00-13:00 break is
 * two windows.
 */
export interface DaySchedule {
  readonly ranges: readonly TimeRange[];
  readonly breaks: readonly TimeRange[];
}

/** The seven days of a week, keyed by ISO weekday. */
export type WeeklyHours = Readonly<Record<Weekday, DaySchedule>>;

export const CLOSED_DAY: DaySchedule = { ranges: [], breaks: [] };

/** The days of a week in order, Monday first. */
// eslint-disable-next-line no-magic-numbers -- the ISO 8601 weekday numbers are the definition itself
export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

function toIntervals(
  ranges: readonly TimeRange[],
  date: LocalDate,
  zone: TimeZone,
): TimeInterval[] {
  return mergeIntervals(
    ranges
      .map((range) =>
        createInterval(
          firstInstantReading(date, range.startMinute, zone),
          firstInstantReading(date, range.endMinute, zone),
        ),
      )
      .filter(isDefined),
  );
}

/**
 * The windows of one local day as instants: its ranges minus its breaks. The boundaries use the
 * first instant the wall clock reads a time (`firstInstantReading`), so on a daylight-saving day a
 * window is as long as the clock says it is, not as long as it looks: 00:00-04:00 on the day the
 * clocks jump forward at 02:00 is three real hours.
 */
export function windowsForDate(
  schedule: DaySchedule,
  date: LocalDate,
  zone: TimeZone,
): TimeInterval[] {
  return subtractIntervals(
    toIntervals(schedule.ranges, date, zone),
    toIntervals(schedule.breaks, date, zone),
  );
}

/**
 * The windows across a range of local days, merged. Two windows that meet at midnight become one,
 * which lets an appointment run across midnight when the place is open on both sides of it.
 * Absences, closures and holidays are subtracted by the caller (`subtractIntervals`).
 */
export function windowsForRange(
  weekly: WeeklyHours,
  range: LocalDateRange,
  zone: TimeZone,
): TimeInterval[] {
  return mergeIntervals(
    datesOf(range).flatMap((date) => windowsForDate(weekly[weekdayOf(date)], date, zone)),
  );
}
