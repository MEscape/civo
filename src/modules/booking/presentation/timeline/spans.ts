import {
  MINUTES_PER_DAY,
  formatTimeOfDay,
  parseTimeOfDay,
} from '../../application/contracts/booking-constraints';

import type { RangeForm } from '../drafts/availability-plan-form';

/** A stretch of a day in minutes since midnight. `end` is exclusive and never before `start`. */
export interface Span {
  readonly start: number;
  readonly end: number;
}

/** Times are set in steps of this many minutes: fine enough for a lunch break, coarse enough to drag. */
export const SNAP_MINUTES = 15;

/** The shortest stretch a bar can be dragged to: long enough to keep both edges and the bar itself within reach. */
export const MIN_SPAN_MINUTES = 2 * SNAP_MINUTES;

export const HOUR_MINUTES = 60;
export const PERCENT = 100;

const WHOLE_DAY: Span = { start: 0, end: MINUTES_PER_DAY };

export function snap(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** The stretches of a form's ranges, earliest first; a range that does not read as a time is left out. */
export function spansOf(ranges: readonly RangeForm[]): Span[] {
  return ranges
    .flatMap((range) => {
      const start = parseTimeOfDay(range.start);
      const end = parseTimeOfDay(range.end);
      return start === null || end === null || end <= start ? [] : [{ start, end }];
    })
    .sort((a, b) => a.start - b.start);
}

export function rangesOf(spans: readonly Span[]): RangeForm[] {
  return spans.map((span) => ({
    start: formatTimeOfDay(span.start),
    end: formatTimeOfDay(span.end),
  }));
}

/** The bars of one day, and the stretches of the parent they must stay inside (`null`: only the day bounds them). */
export interface Lane {
  readonly spans: readonly Span[];
  readonly parents: readonly Span[] | null;
}

/** The stretch of `parents` that contains `minute`, or the whole day when there are no parents. */
export function enclosing(parents: readonly Span[] | null, minute: number): Span | null {
  if (parents === null) {
    return WHOLE_DAY;
  }
  return parents.find((parent) => minute >= parent.start && minute < parent.end) ?? null;
}

/** How far a bar may reach: between its neighbours, and inside the stretch of the parent it sits in. */
function room({ spans, parents }: Lane, index: number): Span | null {
  const current = spans[index];
  if (current === undefined) {
    return null;
  }
  const parent = enclosing(parents, current.start);
  if (parent === null) {
    return null;
  }
  const before = spans[index - 1];
  const after = spans[index + 1];
  return {
    start: Math.max(parent.start, before?.end ?? WHOLE_DAY.start),
    end: Math.min(parent.end, after?.start ?? WHOLE_DAY.end),
  };
}

function replaceAt(spans: readonly Span[], index: number, next: Span): Span[] {
  return spans.map((span, position) => (position === index ? next : span));
}

/** Moves a bar by `delta` minutes, keeping its length, without crossing a neighbour or leaving its parent. */
export function moveSpan(lane: Lane, index: number, delta: number): Span[] {
  const { spans } = lane;
  const current = spans[index];
  const limits = room(lane, index);
  if (current === undefined || limits === null) {
    return [...spans];
  }
  const length = current.end - current.start;
  const start = clamp(snap(current.start + delta), limits.start, limits.end - length);
  return replaceAt(spans, index, { start, end: start + length });
}

/** Moves one edge of a bar to `to`, keeping at least the shortest length and the same limits as `moveSpan`. */
export function resizeSpan(
  lane: Lane,
  index: number,
  { edge, to }: { readonly edge: 'start' | 'end'; readonly to: number },
): Span[] {
  const { spans } = lane;
  const current = spans[index];
  const limits = room(lane, index);
  if (current === undefined || limits === null) {
    return [...spans];
  }
  const next =
    edge === 'start'
      ? { start: clamp(snap(to), limits.start, current.end - MIN_SPAN_MINUTES), end: current.end }
      : {
          start: current.start,
          end: clamp(snap(to), current.start + MIN_SPAN_MINUTES, limits.end),
        };
  return replaceAt(spans, index, next);
}

/**
 * Adds a bar starting at `at` (snapped) of up to `length` minutes, shortened to
 * fit before the next bar and inside the parent. `null` when `at` is inside an
 * existing bar, outside the parent, or leaves no room for the shortest bar.
 */
export function addSpan(
  { spans, parents }: Lane,
  { at, length }: { readonly at: number; readonly length: number },
): Span[] | null {
  const parent = enclosing(parents, at);
  const start = snap(at);
  if (parent === null || start < parent.start || start >= parent.end) {
    return null;
  }
  if (spans.some((span) => start >= span.start && start < span.end)) {
    return null;
  }
  const next = spans.find((span) => span.start > start);
  const end = Math.min(start + length, parent.end, next?.start ?? WHOLE_DAY.end);
  if (end - start < MIN_SPAN_MINUTES) {
    return null;
  }
  return [...spans, { start, end }].sort((a, b) => a.start - b.start);
}

export function sameSpans(a: readonly Span[], b: readonly Span[]): boolean {
  return (
    a.length === b.length &&
    a.every((span, position) => {
      const other = b[position];
      return span.start === other?.start && span.end === other.end;
    })
  );
}

/** The stretches of `spans` with everything inside `holes` taken out, e.g. opening hours without their breaks. */
export function subtractSpans(spans: readonly Span[], holes: readonly Span[]): Span[] {
  return holes
    .reduce<Span[]>(
      (rest, hole) =>
        rest.flatMap((span) => {
          if (hole.end <= span.start || hole.start >= span.end) {
            return [span];
          }
          return [
            ...(hole.start > span.start ? [{ start: span.start, end: hole.start }] : []),
            ...(hole.end < span.end ? [{ start: hole.end, end: span.end }] : []),
          ];
        }),
      [...spans],
    )
    .sort((a, b) => a.start - b.start);
}

/** The stretches covered by either list, touching or overlapping ones merged. */
export function unionSpans(a: readonly Span[], b: readonly Span[]): Span[] {
  const merged: Span[] = [];
  for (const span of [...a, ...b].sort((x, y) => x.start - y.start)) {
    const last = merged.at(-1);
    if (last !== undefined && span.start <= last.end) {
      merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, span.end) };
    } else {
      merged.push(span);
    }
  }
  return merged;
}

export function removeSpan(spans: readonly Span[], index: number): Span[] {
  return spans.filter((_, position) => position !== index);
}

/**
 * Keeps only the part of each break that lies inside an open stretch, so
 * shortening the opening hours never leaves a break hanging outside them. A
 * piece shorter than the shortest bar is dropped.
 */
export function clipToParents(spans: readonly Span[], parents: readonly Span[]): Span[] {
  return spans.flatMap((span) =>
    parents.flatMap((parent) => {
      const start = Math.max(span.start, parent.start);
      const end = Math.min(span.end, parent.end);
      return end - start >= MIN_SPAN_MINUTES ? [{ start, end }] : [];
    }),
  );
}

const DEFAULT_WINDOW_START_HOUR = 7;
const DEFAULT_WINDOW_END_HOUR = 19;
const DEFAULT_WINDOW: Span = {
  start: DEFAULT_WINDOW_START_HOUR * HOUR_MINUTES,
  end: DEFAULT_WINDOW_END_HOUR * HOUR_MINUTES,
};
const WINDOW_PADDING = HOUR_MINUTES;

/**
 * The hours a week of tracks shows, the same for every day so they line up:
 * what the bars (and the parent's hours) cover with an hour of room on each
 * side, and never less than a normal working day.
 */
export function windowOf(allSpans: readonly Span[]): Span {
  const starts = [DEFAULT_WINDOW.start, ...allSpans.map((span) => span.start - WINDOW_PADDING)];
  const ends = [DEFAULT_WINDOW.end, ...allSpans.map((span) => span.end + WINDOW_PADDING)];
  const hour = 60;
  return {
    start: Math.max(0, Math.floor(Math.min(...starts) / hour) * hour),
    end: Math.min(MINUTES_PER_DAY, Math.ceil(Math.max(...ends) / hour) * hour),
  };
}
