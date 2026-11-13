import { MINUTES_PER_DAY, readableRanges } from './time';

import type { DayDto } from '../../dto/location-dto';

/**
 * The stretch of the day a bar draws, in minutes after midnight. Most places open between six and
 * eight, so that is the default: the bar gives the hours that matter its width and the night none.
 * It widens to hold whatever has been set outside it.
 */
export interface HoursRange {
  readonly from: number;
  readonly to: number;
  /** Minutes between two marks of the axis. */
  readonly step: number;
}

const DEFAULT_FROM = 360;
const DEFAULT_TO = 1200;
const NARROW_STEP = 120;
const WIDE_STEP = 180;
/** A range wider than this gets marks every three hours: two-hour marks would crowd the axis. */
const NARROW_LIMIT = 960;

function aligned(from: number, to: number): HoursRange {
  const narrow = {
    from: Math.floor(from / NARROW_STEP) * NARROW_STEP,
    to: Math.min(MINUTES_PER_DAY, Math.ceil(to / NARROW_STEP) * NARROW_STEP),
    step: NARROW_STEP,
  };
  if (narrow.to - narrow.from <= NARROW_LIMIT) {
    return narrow;
  }
  return {
    from: Math.floor(from / WIDE_STEP) * WIDE_STEP,
    to: Math.min(MINUTES_PER_DAY, Math.ceil(to / WIDE_STEP) * WIDE_STEP),
    step: WIDE_STEP,
  };
}

export const DEFAULT_HOURS_RANGE: HoursRange = aligned(DEFAULT_FROM, DEFAULT_TO);

/** `range`, widened to hold every readable range of `days`; it never narrows, so a bar being dragged keeps its scale. */
export function widenRange(range: HoursRange, days: readonly DayDto[]): HoursRange {
  const all = days.flatMap((day) => readableRanges([...day.intervals, ...day.breaks]));
  const from = Math.min(range.from, ...all.map(({ start }) => start));
  const to = Math.max(range.to, ...all.map(({ end }) => end));
  return from === range.from && to === range.to ? range : aligned(from, to);
}

/** The marks of the axis, first to last. */
export function marksOf({ from, to, step }: HoursRange): number[] {
  return Array.from(
    { length: Math.floor((to - from) / step) + 1 },
    (_, index) => from + index * step,
  );
}
