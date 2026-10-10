/**
 * A half-open span of time `[start, end)` between two UTC instants, in epoch
 * milliseconds. Half-open, so an appointment ending at 10:00 and one starting
 * at 10:00 touch without overlapping.
 *
 * Availability is interval algebra: windows are intersected, bookings are
 * subtracted, and a slot is valid when its occupied interval fits inside what
 * remains. Every list function below takes and returns lists that are sorted
 * and non-overlapping ("normalized"); `mergeIntervals` produces one from any
 * list.
 */
export interface TimeInterval {
  readonly start: number;
  readonly end: number;
}

/** `null` when the span is empty or reversed. */
export function createInterval(start: number, end: number): TimeInterval | null {
  return end > start ? { start, end } : null;
}

export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function intervalContains(outer: TimeInterval, inner: TimeInterval): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

export function intervalLength(interval: TimeInterval): number {
  return interval.end - interval.start;
}

/** Sorts and merges overlapping or touching intervals into a normalized list. */
export function mergeIntervals(intervals: readonly TimeInterval[]): TimeInterval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: TimeInterval[] = [];
  for (const interval of sorted) {
    const last = merged.at(-1);
    if (last !== undefined && interval.start <= last.end) {
      merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, interval.end) };
    } else {
      merged.push(interval);
    }
  }
  return merged;
}

/** The parts of `a` that are also in `b`. Both lists must be normalized. */
export function intersectIntervals(
  a: readonly TimeInterval[],
  b: readonly TimeInterval[],
): TimeInterval[] {
  const result: TimeInterval[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const left = a[i];
    const right = b[j];
    if (left === undefined || right === undefined) {
      break;
    }
    const overlap = createInterval(
      Math.max(left.start, right.start),
      Math.min(left.end, right.end),
    );
    if (overlap !== null) {
      result.push(overlap);
    }
    if (left.end < right.end) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return result;
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
    while (removalIndex < removals.length) {
      const removal = removals[removalIndex];
      if (removal === undefined || removal.start >= interval.end) {
        break;
      }
      if (removal.end <= cursor) {
        removalIndex += 1;
        continue;
      }
      const before = createInterval(cursor, removal.start);
      if (before !== null) {
        result.push(before);
      }
      cursor = Math.max(cursor, removal.end);
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
 * Index of the last interval starting at or before `instant`, or -1. Both
 * lookups below search a normalized list in logarithmic time, because a
 * query asks them for every candidate slot.
 */
function lastStartingAtOrBefore(list: readonly TimeInterval[], instant: number): number {
  let low = 0;
  let high = list.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = list[middle];
    if (candidate !== undefined && candidate.start <= instant) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

/** Whether one interval of the normalized list covers `target` entirely. */
export function listCovers(list: readonly TimeInterval[], target: TimeInterval): boolean {
  const index = lastStartingAtOrBefore(list, target.start);
  const candidate = index === -1 ? undefined : list[index];
  return candidate !== undefined && candidate.end >= target.end;
}

/** Whether any interval of the normalized list overlaps `target`. */
export function listOverlaps(list: readonly TimeInterval[], target: TimeInterval): boolean {
  const index = lastStartingAtOrBefore(list, target.start);
  const before = index === -1 ? undefined : list[index];
  if (before !== undefined && before.end > target.start) {
    return true;
  }
  const after = list[index + 1];
  return after !== undefined && after.start < target.end;
}
