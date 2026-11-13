import { clamp } from '@lib/utils';

import type { ResourceTodayDto } from '../dto/resource-dto';

const PERCENT = 100;

export interface TodaySegment {
  readonly key: string;
  /** Where the stretch starts and how wide it is, in percent of the opening hours. */
  readonly left: number;
  readonly width: number;
  readonly isFull: boolean;
  /** The stretch as words, e.g. "10:30–11:00". */
  readonly hours: string;
}

export interface TodayBar {
  /** The opening hours as words. */
  readonly hours: string;
  readonly segments: readonly TodaySegment[];
}

/**
 * Today's use of a resource laid out on its opening hours: each stretch in use as a part of the bar,
 * clipped to the hours. `null` when the location is closed today. Times arrive as ISO text with
 * their offset, so their distance is plain arithmetic; the words come from `timeRange`.
 */
export function todayBar(
  today: ResourceTodayDto,
  timeRange: (start: string, end: string, zone: string) => string,
): TodayBar | null {
  const { window, busy, timeZone } = today;
  if (window === null) {
    return null;
  }
  const from = Date.parse(window.start);
  const length = Date.parse(window.end) - from;
  const percentOf = (instant: string) =>
    clamp(((Date.parse(instant) - from) / length) * PERCENT, 0, PERCENT);
  return {
    hours: timeRange(window.start, window.end, timeZone),
    segments: busy.map((span) => ({
      key: span.start,
      left: percentOf(span.start),
      width: percentOf(span.end) - percentOf(span.start),
      isFull: span.isFull,
      hours: timeRange(span.start, span.end, timeZone),
    })),
  };
}
