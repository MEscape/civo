import { toWeekly } from '../models/availability-plan';
import { WEEKDAYS } from '../time/local-date';

import type { AvailabilityPlan, DaySchedule, TimeRange } from '../models/availability-plan';
import type { Weekday } from '../time/local-date';

/** The stretches of a day merged where they touch, so an interval that spans two neighbours still counts as covered. */
function merged(ranges: readonly TimeRange[]): readonly TimeRange[] {
  const result: TimeRange[] = [];
  for (const range of [...ranges].sort((a, b) => a.startMinute - b.startMinute)) {
    const last = result.at(-1);
    if (last !== undefined && range.startMinute <= last.endMinute) {
      result[result.length - 1] = {
        startMinute: last.startMinute,
        endMinute: Math.max(last.endMinute, range.endMinute),
      };
    } else {
      result.push(range);
    }
  }
  return result;
}

function isCovered(range: TimeRange, frame: readonly TimeRange[]): boolean {
  return frame.some(
    (open) => open.startMinute <= range.startMinute && range.endMinute <= open.endMinute,
  );
}

/**
 * The weekdays on which `plan` is open at a time `frame` is not. A resource,
 * a service or an employee can only be available while the place is open, so
 * this is what "their hours must stay inside the location's" means. It looks
 * at the weekly pattern: a dated exception names one day and is always
 * intersected with the location's plan for that day when slots are found, so
 * it can narrow but never widen what the place offers.
 */
export function weekdaysOutside(
  plan: AvailabilityPlan,
  frame: AvailabilityPlan,
): readonly Weekday[] {
  return WEEKDAYS.filter((weekday) => {
    const open = merged(frame.weekly[weekday].intervals);
    return plan.weekly[weekday].intervals.some((range) => !isCovered(range, open));
  });
}

function clipRanges(ranges: readonly TimeRange[], frame: readonly TimeRange[]): TimeRange[] {
  return ranges
    .flatMap((range) =>
      frame.map((open) => ({
        startMinute: Math.max(range.startMinute, open.startMinute),
        endMinute: Math.min(range.endMinute, open.endMinute),
      })),
    )
    .filter((clipped) => clipped.endMinute > clipped.startMinute)
    .sort((a, b) => a.startMinute - b.startMinute);
}

function clipDay(day: DaySchedule, frame: readonly TimeRange[]): DaySchedule {
  const intervals = clipRanges(day.intervals, frame);
  return { intervals, breaks: clipRanges(day.breaks, intervals) };
}

/**
 * The plan cut down to what `frame` is open: each day keeps only the parts of
 * its stretches inside the frame's, and a break survives only inside what is
 * left. It is what happens to an employee's week when the hours employees may
 * work at a place are narrowed. Dated exceptions are left as they are: they
 * are intersected with the location's plan whenever slots are found.
 */
export function clipToFrame(plan: AvailabilityPlan, frame: AvailabilityPlan): AvailabilityPlan {
  return {
    weekly: toWeekly(
      WEEKDAYS.map((weekday) =>
        clipDay(plan.weekly[weekday], merged(frame.weekly[weekday].intervals)),
      ),
    ),
    exceptions: plan.exceptions,
  };
}
