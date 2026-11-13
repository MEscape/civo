import type { FieldErrorBag } from '@lib/errors';

import { BOOKING_VALIDATION_CODES as CODES } from '../../domain/errors/booking-errors';
import { createTimeRange } from '../../domain/scheduling/weekly-hours';
import { parseTimeOfDay } from '../../domain/time/time-of-day';
import { LOCATION_LIMITS as LIMITS } from '../contracts/booking-constraints';

import type { DaySchedule, TimeRange, WeeklyHours } from '../../domain/scheduling/weekly-hours';
import type { DayInput, RangeInput } from '../contracts/location-inputs';

const DAYS_PER_WEEK = 7;

const byStart = (a: TimeRange, b: TimeRange) => a.startMinute - b.startMinute;

function parseRange(range: RangeInput, path: string, bag: FieldErrorBag): TimeRange | null {
  const start = parseTimeOfDay(range.start);
  const end = parseTimeOfDay(range.end);
  const parsed = start === null || end === null ? null : createTimeRange(start, end);
  if (parsed === null) {
    bag.add(`${path}.${start === null ? 'start' : 'end'}`, CODES.timeRangeInvalid);
  }
  return parsed;
}

/** The ranges that read, each with the position it had in the request so an error names the right row. */
function parseRanges(
  ranges: readonly RangeInput[],
  path: string,
  bag: FieldErrorBag,
): Array<{ readonly index: number; readonly range: TimeRange }> {
  if (!bag.expect(ranges.length <= LIMITS.rangesPerDayMax, path, CODES.tooMany)) {
    return [];
  }
  return ranges.flatMap((range, index) => {
    const parsed = parseRange(range, `${path}.${index}`, bag);
    return parsed === null ? [] : [{ index, range: parsed }];
  });
}

/** Marks every range that starts before an earlier one has ended, and returns the ranges in order. */
function inOrderWithoutOverlap(
  parsed: ReadonlyArray<{ readonly index: number; readonly range: TimeRange }>,
  path: string,
  bag: FieldErrorBag,
): TimeRange[] {
  const sorted = [...parsed].sort((x, y) => byStart(x.range, y.range));
  let reach = 0;
  for (const { index, range } of sorted) {
    if (range.startMinute < reach) {
      bag.add(`${path}.${index}.start`, CODES.timeRangesOverlap);
    }
    reach = Math.max(reach, range.endMinute);
  }
  return sorted.map(({ range }) => range);
}

export function parseDay(day: DayInput, path: string, bag: FieldErrorBag): DaySchedule {
  const intervals = inOrderWithoutOverlap(
    parseRanges(day.intervals, `${path}.intervals`, bag),
    `${path}.intervals`,
    bag,
  );
  const parsedBreaks = parseRanges(day.breaks, `${path}.breaks`, bag);
  const breaks = inOrderWithoutOverlap(parsedBreaks, `${path}.breaks`, bag);
  for (const { index, range } of parsedBreaks) {
    const isInsideOpenHours = intervals.some(
      (open) => open.startMinute <= range.startMinute && range.endMinute <= open.endMinute,
    );
    bag.expect(isInsideOpenHours, `${path}.breaks.${index}.start`, CODES.breakOutsideHours);
  }
  return { ranges: intervals, breaks };
}

export function parseWeek(days: readonly DayInput[], bag: FieldErrorBag): WeeklyHours | null {
  if (!bag.expect(days.length === DAYS_PER_WEEK, 'openingHours.weekly', CODES.weekInvalid)) {
    return null;
  }
  const [monday, tuesday, wednesday, thursday, friday, saturday, sunday] = days.map((day, index) =>
    parseDay(day, `openingHours.weekly.${index}`, bag),
  );
  return monday && tuesday && wednesday && thursday && friday && saturday && sunday
    ? { 1: monday, 2: tuesday, 3: wednesday, 4: thursday, 5: friday, 6: saturday, 7: sunday }
    : null;
}
