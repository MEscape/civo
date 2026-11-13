import { MINUTES_PER_HOUR, readableRanges } from './time';

import type { WeekDraft } from './draft';
import type { Minutes } from './time';
import type { DayDto } from '../../dto/location-dto';

const lengthOf = (ranges: readonly Minutes[]) =>
  ranges.reduce((sum, { start, end }) => sum + (end - start), 0);

/** Open minutes of a day: its ranges less its breaks. */
export function dayMinutes(day: DayDto): number {
  return Math.max(
    0,
    lengthOf(readableRanges(day.intervals)) - lengthOf(readableRanges(day.breaks)),
  );
}

export function weekMinutes(week: WeekDraft): number {
  return week.reduce((sum, day) => sum + dayMinutes(day), 0);
}

/** A number of minutes as whole hours and the minutes left over. */
export function hoursAndMinutes(total: number): {
  readonly hours: number;
  readonly minutes: number;
} {
  return { hours: Math.floor(total / MINUTES_PER_HOUR), minutes: total % MINUTES_PER_HOUR };
}
