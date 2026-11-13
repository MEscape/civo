import { clamp, insertItem, replaceAt } from '@lib/utils';

import { MINUTES_PER_DAY, minutesOf, timeOf } from './time';

import type { Minutes } from './time';
import type { DayDto, RangeDto } from '../../dto/location-dto';

export type RangeKind = 'intervals' | 'breaks';
export type DragPart = 'start' | 'end' | 'move';
export interface Segment {
  readonly kind: RangeKind;
  readonly index: number;
  readonly start: number;
  readonly end: number;
}
export interface HoursTarget {
  readonly kind: RangeKind;
  readonly index: number;
  readonly part: DragPart;
  /**
   * The stretches the place is open (for an employee or a resource that works inside them): an opening
   * range cannot be moved or stretched out of the stretch it is in. None given, any time of the day.
   */
  readonly limits?: readonly Minutes[] | undefined;
}

const MINIMUM_LENGTH = 1;

/** The stretch of `limits` a range lies in (or, failing that, the one it touches), or `null` when there are none. */
function limitOf(limits: readonly Minutes[] | undefined, range: Minutes): Minutes | null {
  if (limits === undefined) {
    return null;
  }
  return (
    limits.find((limit) => limit.start <= range.start && limit.end >= range.end) ??
    limits.find((limit) => limit.start < range.end && limit.end > range.start) ??
    null
  );
}
/** What a press on the empty bar opens: an hour, or what is left before the next opening range. */
const NEW_INTERVAL_MINUTES = 60;

export function parseRange(range: RangeDto) {
  const start = minutesOf(range.start);
  const end = minutesOf(range.end);
  return start !== null && end !== null && start < end ? { start, end } : null;
}

export function segmentsOf(day: DayDto): Segment[] {
  return (['intervals', 'breaks'] as const).flatMap((kind) =>
    day[kind].flatMap((range, index) => {
      const parsed = parseRange(range);
      return parsed === null ? [] : [{ kind, index, ...parsed }];
    }),
  );
}

/** What a range of `kind` has to stay inside: a break its opening range, an opening range the day or the stretch of the place it is in. */
function parentOf(
  day: DayDto,
  { kind, limits }: Pick<HoursTarget, 'kind' | 'limits'>,
  range: Minutes,
): Minutes | null {
  if (kind === 'breaks') {
    return (
      day.intervals
        .map(parseRange)
        .find((item) => item !== null && item.start <= range.start && item.end >= range.end) ?? null
    );
  }
  return limitOf(limits, range) ?? { start: 0, end: MINUTES_PER_DAY };
}

/**
 * Keeps a visual edit inside its neighbours and opening interval, including the breaks it carries
 * (and, with the target's `limits`, inside the opening hours of the place).
 */
export function changeHoursRange(
  day: DayDto,
  { kind, index, part, limits }: HoursTarget,
  delta: number,
): DayDto {
  const source = day[kind][index];
  const range = source === undefined ? null : parseRange(source);
  if (range === null) {
    return day;
  }
  const neighbours = day[kind].flatMap((item, position) => {
    const parsed = position === index ? null : parseRange(item);
    return parsed === null ? [] : [parsed];
  });
  if (neighbours.some((item) => item.start < range.end && item.end > range.start)) {
    return day;
  }
  const parent = parentOf(day, { kind, limits }, range);
  if (parent === null) {
    return day;
  }
  const low = Math.max(
    parent.start,
    ...neighbours.filter((item) => item.end <= range.start).map((item) => item.end),
  );
  const high = Math.min(
    parent.end,
    ...neighbours.filter((item) => item.start >= range.end).map((item) => item.start),
  );
  const contained =
    kind === 'intervals'
      ? day.breaks.flatMap((item) => {
          const parsed = parseRange(item);
          return parsed !== null && parsed.start >= range.start && parsed.end <= range.end
            ? [parsed]
            : [];
        })
      : [];
  const offset = clamp(delta, low - range.start, high - range.end);
  const next = { ...range };
  if (part === 'move') {
    next.start += offset;
    next.end += offset;
  } else if (part === 'start') {
    next.start = clamp(
      range.start + delta,
      low,
      Math.min(range.end - MINIMUM_LENGTH, ...contained.map((item) => item.start)),
    );
  } else {
    next.end = clamp(
      range.end + delta,
      Math.max(range.start + MINIMUM_LENGTH, ...contained.map((item) => item.end)),
      high,
    );
  }
  const changed = replaceAt(day[kind], index, { start: timeOf(next.start), end: timeOf(next.end) });
  if (kind === 'breaks') {
    return { ...day, breaks: changed };
  }
  return {
    ...day,
    intervals: changed,
    breaks:
      part !== 'move'
        ? day.breaks
        : day.breaks.map((item) => {
            const parsed = parseRange(item);
            return parsed !== null && parsed.start >= range.start && parsed.end <= range.end
              ? { start: timeOf(parsed.start + offset), end: timeOf(parsed.end + offset) }
              : item;
          }),
  };
}

/**
 * A new opening range that starts at `minute` (a press on the empty bar), as long as an hour or as
 * the room before the next range allows, placed among the others by start time. `null` where the
 * press fell inside a range or leaves no room.
 */
export function intervalAt(
  day: DayDto,
  minute: number,
  limits?: readonly Minutes[],
): { day: DayDto; index: number } | null {
  const limit = limits?.find((candidate) => candidate.start <= minute && minute < candidate.end);
  if (limits !== undefined && limit === undefined) {
    return null;
  }
  const readable = day.intervals.map(parseRange);
  if (readable.some((range) => range !== null && range.start <= minute && minute < range.end)) {
    return null;
  }
  const next = Math.min(
    limit?.end ?? MINUTES_PER_DAY,
    ...readable.flatMap((range) => (range !== null && range.start > minute ? [range.start] : [])),
  );
  const end = Math.min(minute + NEW_INTERVAL_MINUTES, next);
  if (end <= minute) {
    return null;
  }
  const before = readable.reduce(
    (position, range, index) => (range !== null && range.start < minute ? index + 1 : position),
    0,
  );
  return {
    day: {
      ...day,
      intervals: insertItem(day.intervals, before, { start: timeOf(minute), end: timeOf(end) }),
    },
    index: before,
  };
}
