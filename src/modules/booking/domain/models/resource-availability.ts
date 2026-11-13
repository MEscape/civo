import { WEEKDAYS } from '../scheduling/weekly-hours';
import { MINUTES_PER_DAY } from '../time/time-of-day';

import type { AvailabilityException, AvailabilityPlan } from '../scheduling/availability-plan';
import type { DaySchedule, WeeklyHours } from '../scheduling/weekly-hours';

/**
 * When a physical resource can be used. It is always read inside its location's opening hours
 * (`scheduleOf` intersects the two), so "like the location" is a week that is open all day, and a
 * block ("Sperrzeit", maintenance) is a closed day. Nothing more is stored: whether a resource
 * follows its location is read back from the week, not kept as a flag that could disagree with it.
 */
const ALL_DAY: DaySchedule = {
  ranges: [{ startMinute: 0, endMinute: MINUTES_PER_DAY }],
  breaks: [],
};

const ALL_DAY_WEEK: WeeklyHours = {
  1: ALL_DAY,
  2: ALL_DAY,
  3: ALL_DAY,
  4: ALL_DAY,
  5: ALL_DAY,
  6: ALL_DAY,
  7: ALL_DAY,
};

/** A resource closed on its own days: only closures, the one kind of exception a resource has. */
export type ResourceBlock = AvailabilityException & { readonly kind: 'closed' };

const isAllDay = (day: DaySchedule) =>
  day.breaks.length === 0 &&
  day.ranges.length === 1 &&
  day.ranges[0]?.startMinute === 0 &&
  day.ranges[0].endMinute === MINUTES_PER_DAY;

/** Whether the resource keeps its location's hours (with or without blocks). */
export function followsLocation(plan: AvailabilityPlan | null): boolean {
  return plan === null || WEEKDAYS.every((weekday) => isAllDay(plan.weekly[weekday]));
}

/** The resource's own week, or `null` when it keeps its location's hours. */
export function ownWeekOf(plan: AvailabilityPlan | null): WeeklyHours | null {
  return plan === null || followsLocation(plan) ? null : plan.weekly;
}

export function blocksOf(plan: AvailabilityPlan | null): ResourceBlock[] {
  return (plan?.exceptions ?? []).filter(
    (exception): exception is ResourceBlock => exception.kind === 'closed',
  );
}

/**
 * The plan to store: `null` for "like the location" without blocks, so a resource that was never
 * given hours of its own reads exactly as before.
 */
export function resourcePlan(
  ownWeek: WeeklyHours | null,
  blocks: readonly ResourceBlock[],
): AvailabilityPlan | null {
  if (ownWeek === null && blocks.length === 0) {
    return null;
  }
  return { weekly: ownWeek ?? ALL_DAY_WEEK, exceptions: blocks };
}
