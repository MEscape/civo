import { toEpochDay, weekdayOf } from '../time/local-date';
import { datesOf } from '../time/local-date-range';
import { mergeIntervals } from '../time/time-interval';

import { windowsForDate } from './weekly-hours';

import type { DaySchedule, WeeklyHours } from './weekly-hours';
import type { LocalDate } from '../time/local-date';
import type { LocalDateRange } from '../time/local-date-range';
import type { TimeInterval } from '../time/time-interval';
import type { TimeZone } from '../time/time-zone';

/**
 * What a dated exception does to the week (the vocabulary the first version of the module stored):
 *
 * - `closed`: nobody is available that day (holiday, absence, closure). Always wins.
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
  /** The hours of an `override` or an `additional` exception; empty for `closed`. */
  readonly day: DaySchedule;
}

/**
 * When a place, a person or a service can be booked: a weekly pattern plus dated exceptions. The
 * same shape serves a location's opening hours, an employee's working hours and a service's own
 * restrictions, so "is it available on this day" is decided in one place.
 */
export interface AvailabilityPlan {
  readonly weekly: WeeklyHours;
  readonly exceptions: readonly AvailabilityException[];
}

function isCovered(exception: AvailabilityException, date: LocalDate): boolean {
  const day = toEpochDay(date);
  return toEpochDay(exception.from) <= day && day <= toEpochDay(exception.to);
}

/**
 * The windows of one local day as instants. A `closed` exception removes the whole day, so a
 * vacation entered over a one-off extra shift cancels the shift, which is what an absence means.
 * Otherwise the day's hours are those of the last `override` covering it, or the weekly pattern;
 * the `additional` exceptions then contribute their own hours, each with its own breaks.
 */
export function availabilityOnDate(
  plan: AvailabilityPlan,
  date: LocalDate,
  zone: TimeZone,
): TimeInterval[] {
  const covering = plan.exceptions.filter((exception) => isCovered(exception, date));
  if (covering.some((exception) => exception.kind === 'closed')) {
    return [];
  }
  const override = [...covering].reverse().find((exception) => exception.kind === 'override');
  const days = [
    override?.day ?? plan.weekly[weekdayOf(date)],
    ...covering.filter((exception) => exception.kind === 'additional').map(({ day }) => day),
  ];
  return mergeIntervals(days.flatMap((day) => windowsForDate(day, date, zone)));
}

/**
 * The windows across a range of local days, merged. Two windows that meet at midnight become one,
 * which lets an appointment run across midnight when the place is open on both sides of it.
 */
export function availabilityOnRange(
  plan: AvailabilityPlan,
  range: LocalDateRange,
  zone: TimeZone,
): TimeInterval[] {
  return mergeIntervals(datesOf(range).flatMap((date) => availabilityOnDate(plan, date, zone)));
}
