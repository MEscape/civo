import { MS_PER_MINUTE } from '@lib/utils';

import { laterOf } from './instant';

import type { Instant } from './instant';

/**
 * A half-open span of time `[start, end)` between two instants. Half-open, so an appointment ending
 * at 10:00 and one starting at 10:00 touch without overlapping, and a span is never empty: `start`
 * is always before `end`.
 *
 * Availability is interval algebra: windows are intersected, bookings are subtracted, and a slot is
 * valid when its occupied span fits inside what remains. A **normalized** list is sorted and has no
 * overlapping or touching members; `mergeIntervals` makes one from any list, and the list functions
 * below expect one and return one.
 */
export interface TimeInterval {
  readonly start: Instant;
  readonly end: Instant;
}

/** `null` when the span is empty or reversed. */
export function createInterval(start: Instant, end: Instant): TimeInterval | null {
  return end > start ? { start, end } : null;
}

/** The length in minutes; whole for the minute-aligned spans the engine builds. */
export function intervalLengthMinutes(interval: TimeInterval): number {
  return (interval.end - interval.start) / MS_PER_MINUTE;
}

/** Whether the two spans share any time. Spans that only touch do not. */
export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Whether `inner` lies entirely within `outer`, boundaries included. */
export function intervalContains(outer: TimeInterval, inner: TimeInterval): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

/** Sorts and merges overlapping or touching spans into a normalized list. */
export function mergeIntervals(intervals: readonly TimeInterval[]): TimeInterval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: TimeInterval[] = [];
  for (const interval of sorted) {
    const last = merged.at(-1);
    if (last !== undefined && interval.start <= last.end) {
      merged[merged.length - 1] = { start: last.start, end: laterOf(last.end, interval.end) };
    } else {
      merged.push(interval);
    }
  }
  return merged;
}

/**
 * Where at least `depth` of the spans overlap, as a normalized list: the times a resource with
 * `depth` places is full. Spans that only touch do not overlap, and a depth of 1 is `mergeIntervals`.
 */
export function intervalsAtDepth(
  intervals: readonly TimeInterval[],
  depth: number,
): TimeInterval[] {
  // At one instant, ends go before starts: half-open spans that touch never stack.
  const edges = intervals
    .flatMap(({ start, end }) => [
      { at: start, step: 1 },
      { at: end, step: -1 },
    ])
    .sort((a, b) => a.at - b.at || a.step - b.step);
  const full: TimeInterval[] = [];
  let count = 0;
  let fullSince: Instant | null = null;
  for (const { at, step } of edges) {
    count += step;
    if (fullSince === null && count >= depth) {
      fullSince = at;
    } else if (fullSince !== null && count < depth) {
      const span = createInterval(fullSince, at);
      if (span !== null) {
        full.push(span);
      }
      fullSince = null;
    }
  }
  return mergeIntervals(full);
}

/**
 * The parts of `a` that are also in `b`: what is left of `a` once what `b` does not cover is taken
 * away. Both lists must be normalized.
 */
export function intersectIntervals(
  a: readonly TimeInterval[],
  b: readonly TimeInterval[],
): TimeInterval[] {
  return subtractIntervals(a, subtractIntervals(a, b));
}

/** The parts of `list` that are not in `removals`. Both lists must be normalized. */
export function subtractIntervals(
  list: readonly TimeInterval[],
  removals: readonly TimeInterval[],
): TimeInterval[] {
  const result: TimeInterval[] = [];
  let removalIndex = 0;
  for (const interval of list) {
    let cursor = interval.start;
    // A removal can span several members of `list`, so the index only moves past removals that end
    // inside the current member.
    while (removalIndex < removals.length && cursor < interval.end) {
      const removal = removals[removalIndex];
      if (removal === undefined || removal.start >= interval.end) {
        break;
      }
      const kept = createInterval(cursor, removal.start);
      if (kept !== null) {
        result.push(kept);
      }
      cursor = laterOf(cursor, removal.end);
      if (removal.end > interval.end) {
        break;
      }
      removalIndex += 1;
    }
    const rest = createInterval(cursor, interval.end);
    if (rest !== null) {
      result.push(rest);
    }
  }
  return result;
}

/**
 * Index of the first member of a normalized list that ends after `instant`, or `list.length`.
 * Both lookups below use it, because a slot query asks for every candidate.
 */
function firstEndingAfter(list: readonly TimeInterval[], instant: Instant): number {
  let low = 0;
  let high = list.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    const candidate = list[middle];
    if (candidate !== undefined && candidate.end <= instant) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

/** Whether one member of the normalized list contains `target` entirely. */
export function listCovers(list: readonly TimeInterval[], target: TimeInterval): boolean {
  const candidate = list[firstEndingAfter(list, target.start)];
  return candidate !== undefined && intervalContains(candidate, target);
}

/** The member of the normalized list that shares time with `target` (the earliest), or `null`. */
export function findOverlap(
  list: readonly TimeInterval[],
  target: TimeInterval,
): TimeInterval | null {
  const candidate = list[firstEndingAfter(list, target.start)];
  return candidate !== undefined && intervalsOverlap(candidate, target) ? candidate : null;
}

/** Whether any member of the normalized list shares time with `target`. */
export function listOverlaps(list: readonly TimeInterval[], target: TimeInterval): boolean {
  return findOverlap(list, target) !== null;
}
