import { eachLocalDate, weekdayOf } from '../time/local-date';
import { mergeIntervals, subtractIntervals } from '../time/time-interval';
import { zonedTimeToEpoch } from '../time/time-zone';

import type {
  AvailabilityException,
  AvailabilityPlan,
  DaySchedule,
  TimeRange,
} from '../models/availability-plan';
import type { LocalDate } from '../time/local-date';
import type { TimeInterval } from '../time/time-interval';
import type { TimeZone } from '../time/time-zone';

function isCoveredBy(exception: AvailabilityException, date: LocalDate): boolean {
  const day = Date.UTC(date.year, date.month - 1, date.day);
  return (
    Date.UTC(exception.from.year, exception.from.month - 1, exception.from.day) <= day &&
    day <= Date.UTC(exception.to.year, exception.to.month - 1, exception.to.day)
  );
}

function toInstants(ranges: readonly TimeRange[], date: LocalDate, zone: TimeZone): TimeInterval[] {
  return mergeIntervals(
    ranges.map((range) => ({
      start: zonedTimeToEpoch(date, range.startMinute, zone),
      end: zonedTimeToEpoch(date, range.endMinute, zone),
    })),
  );
}

/** One day's schedule as instants: its hours minus its own breaks. */
function workingWindows(day: DaySchedule, date: LocalDate, zone: TimeZone): TimeInterval[] {
  return subtractIntervals(
    toInstants(day.intervals, date, zone),
    toInstants(day.breaks, date, zone),
  );
}

/**
 * The bookable windows of one local day, as instants.
 *
 * Precedence, strongest first: a `closed` exception removes the whole day;
 * otherwise the day's hours are those of the last `override` covering it, or
 * the weekly pattern; `additional` exceptions then contribute their own hours
 * (each with its own breaks). Closure always wins, so a vacation entered over
 * a one-off extra shift cancels the shift, which is what an absence means.
 */
export function windowsForDate(
  plan: AvailabilityPlan,
  date: LocalDate,
  zone: TimeZone,
): TimeInterval[] {
  const covering = plan.exceptions.filter((exception) => isCoveredBy(exception, date));
  if (covering.some((exception) => exception.kind === 'closed')) {
    return [];
  }

  const override = [...covering].reverse().find((exception) => exception.kind === 'override');
  const base = override?.day ?? plan.weekly[weekdayOf(date)];
  const extras = covering.filter((exception) => exception.kind === 'additional');

  return mergeIntervals(
    [base, ...extras.map((extra) => extra.day)].flatMap((day) => workingWindows(day, date, zone)),
  );
}

/**
 * The bookable windows across a range of local days, merged. Two windows
 * that meet at midnight become one, which is what lets an appointment run
 * across midnight when the place is open on both sides of it.
 */
export function windowsForRange(
  plan: AvailabilityPlan,
  from: LocalDate,
  to: LocalDate,
  zone: TimeZone,
): TimeInterval[] {
  return mergeIntervals(
    eachLocalDate(from, to).flatMap((date) => windowsForDate(plan, date, zone)),
  );
}
