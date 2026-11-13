import { MS_PER_DAY, MS_PER_MINUTE, MS_PER_SECOND, unique } from '@lib/utils';

import { asInstant } from './instant';
import { toEpochDay } from './local-date';
import { zoneOffsetMs } from './time-zone';

import type { Instant } from './instant';
import type { LocalDate } from './local-date';
import type { TimeZone } from './time-zone';

/**
 * What a wall-clock time means on the timeline. Twice a year a wall-clock time is not exactly one
 * instant:
 *  - `gap`: the clocks skip it (02:30 when 02:00 jumps to 03:00). `transition` is the instant the
 *    clocks jump, the first instant at which the wall clock reads anything later than the gap.
 *  - `ambiguous`: it happens twice (02:30 when 03:00 falls back to 02:00). `first` is the first
 *    occurrence, `second` the repeat.
 */
export type LocalTimeResolution =
  | { readonly kind: 'exact'; readonly instant: Instant }
  | { readonly kind: 'ambiguous'; readonly first: Instant; readonly second: Instant }
  | { readonly kind: 'gap'; readonly transition: Instant };

/**
 * Where the offset changes between `before` (which still has `offsetBefore`) and `after`, to the
 * second. Transitions fall on whole seconds, so halving the span finds the exact instant.
 */
interface TransitionSearch {
  /** An instant still on the old offset. */
  readonly low: number;
  /** An instant already on the new offset. */
  readonly high: number;
  readonly offsetBefore: number;
}

function transitionBetween(search: TransitionSearch, zone: TimeZone): number {
  const { offsetBefore } = search;
  // Whole seconds, widened outwards: both ends keep their offset, and every step stays aligned, so
  // the search ends even for a time that is not a whole minute.
  let low = Math.floor(search.low / MS_PER_SECOND) * MS_PER_SECOND;
  let high = Math.ceil(search.high / MS_PER_SECOND) * MS_PER_SECOND;
  while (high - low > MS_PER_SECOND) {
    const middle = low + Math.floor((high - low) / (2 * MS_PER_SECOND)) * MS_PER_SECOND;
    if (zoneOffsetMs(middle, zone) === offsetBefore) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return high;
}

/**
 * The instants a wall-clock time can mean in a zone. `minuteOfDay` 1440 means local midnight of the
 * next day. Nothing is guessed here: the caller decides what a gap or a repeat means for its
 * purpose (`firstInstantReading` for a boundary, 'not offered' for a bookable start).
 */
export function resolveLocalTime(
  date: LocalDate,
  minuteOfDay: number,
  zone: TimeZone,
): LocalTimeResolution {
  const wallClockAsUtc = toEpochDay(date) * MS_PER_DAY + minuteOfDay * MS_PER_MINUTE;
  // The offsets a day either side bracket any transition near this wall-clock time.
  const offsetBefore = zoneOffsetMs(wallClockAsUtc - MS_PER_DAY, zone);
  const offsetAfter = zoneOffsetMs(wallClockAsUtc + MS_PER_DAY, zone);

  const [first, second] = unique([offsetBefore, offsetAfter])
    .map((offset) => wallClockAsUtc - offset)
    .filter((candidate) => candidate + zoneOffsetMs(candidate, zone) === wallClockAsUtc)
    .sort((a, b) => a - b);

  if (first !== undefined && second !== undefined) {
    return { kind: 'ambiguous', first: asInstant(first), second: asInstant(second) };
  }
  if (first !== undefined) {
    return { kind: 'exact', instant: asInstant(first) };
  }
  // Read with the old offset the time lies after the jump, with the new one before it.
  const transition = transitionBetween(
    { low: wallClockAsUtc - offsetAfter, high: wallClockAsUtc - offsetBefore, offsetBefore },
    zone,
  );
  return { kind: 'gap', transition: asInstant(transition) };
}

/**
 * The first instant at which the wall clock reads `minuteOfDay` or later. For the boundaries of
 * opening hours and days: a time the clocks skip means the moment they jump over it, so a window
 * that ends at 02:30 on the night the clocks jump from 02:00 to 03:00 ends at the jump and not half
 * an hour of wall clock after it, and a window that lies wholly in the gap is empty. A repeated
 * time means its first occurrence.
 */
export function firstInstantReading(date: LocalDate, minuteOfDay: number, zone: TimeZone): Instant {
  const resolution = resolveLocalTime(date, minuteOfDay, zone);
  switch (resolution.kind) {
    case 'exact':
      return resolution.instant;
    case 'ambiguous':
      return resolution.first;
    case 'gap':
      return resolution.transition;
  }
}

/**
 * The first instant of a local day. Where midnight does not exist (some zones switch at midnight)
 * this is the first real instant of that day. A day is not always 24 hours: it ends where the next
 * one starts.
 */
export function startOfLocalDay(date: LocalDate, zone: TimeZone): Instant {
  return firstInstantReading(date, 0, zone);
}
