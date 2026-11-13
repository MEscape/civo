import { describe, expect, it } from 'vitest';

import { addMinutes, parseInstant } from '@modules/booking/domain/time/instant';
import type { Instant } from '@modules/booking/domain/time/instant';
import { parseMinutes } from '@modules/booking/domain/time/minutes';
import {
  createInterval,
  intersectIntervals,
  intervalContains,
  intervalLengthMinutes,
  intervalsAtDepth,
  intervalsOverlap,
  listCovers,
  listOverlaps,
  mergeIntervals,
  subtractIntervals,
} from '@modules/booking/domain/time/time-interval';
import type { TimeInterval } from '@modules/booking/domain/time/time-interval';

const ORIGIN = parseInstant('2027-01-11T00:00:00Z');

/** The instant `minute` minutes after a fixed origin; the tests think in plain minute numbers. */
function m(minute: number): Instant {
  const offset = parseMinutes(minute);
  if (ORIGIN === null || offset === null) {
    throw new Error('fixture');
  }
  return addMinutes(ORIGIN, offset);
}

function iv(from: number, to: number): TimeInterval {
  const interval = createInterval(m(from), m(to));
  if (interval === null) {
    throw new Error(`empty interval ${from}-${to}`);
  }
  return interval;
}

/** The minute numbers of a list, for readable expectations. */
function pairs(list: readonly TimeInterval[]): Array<[number, number]> {
  const origin = m(0);
  return list.map((interval) => [
    (interval.start - origin) / 60_000,
    (interval.end - origin) / 60_000,
  ]);
}

describe('creating an interval', () => {
  it('is half-open and never empty', () => {
    expect(createInterval(m(10), m(20))).not.toBeNull();
    expect(createInterval(m(10), m(10))).toBeNull();
    expect(createInterval(m(20), m(10))).toBeNull();
  });

  it('measures its length in minutes', () => {
    expect(intervalLengthMinutes(iv(10, 70))).toBe(60);
    expect(intervalLengthMinutes(iv(0, 1))).toBe(1);
  });
});

describe('overlap and containment', () => {
  it('does not overlap when one ends exactly where the other starts', () => {
    expect(intervalsOverlap(iv(0, 10), iv(10, 20))).toBe(false);
    expect(intervalsOverlap(iv(10, 20), iv(0, 10))).toBe(false);
  });

  it('overlaps by a single minute', () => {
    expect(intervalsOverlap(iv(0, 11), iv(10, 20))).toBe(true);
    expect(intervalsOverlap(iv(10, 20), iv(0, 11))).toBe(true);
  });

  it('overlaps when identical, nested or containing', () => {
    expect(intervalsOverlap(iv(0, 10), iv(0, 10))).toBe(true);
    expect(intervalsOverlap(iv(0, 100), iv(40, 50))).toBe(true);
    expect(intervalsOverlap(iv(40, 50), iv(0, 100))).toBe(true);
  });

  it('does not overlap when apart', () => {
    expect(intervalsOverlap(iv(0, 10), iv(11, 20))).toBe(false);
  });

  it('contains an interval with the same boundaries', () => {
    expect(intervalContains(iv(0, 10), iv(0, 10))).toBe(true);
  });

  it('contains a strictly inner interval but not one that sticks out by a minute', () => {
    expect(intervalContains(iv(0, 100), iv(40, 50))).toBe(true);
    expect(intervalContains(iv(0, 100), iv(40, 101))).toBe(false);
    expect(intervalContains(iv(0, 100), iv(0, 100))).toBe(true);
    expect(intervalContains(iv(10, 100), iv(9, 50))).toBe(false);
  });

  it('does not contain a larger interval or a disjoint one', () => {
    expect(intervalContains(iv(40, 50), iv(0, 100))).toBe(false);
    expect(intervalContains(iv(0, 10), iv(20, 30))).toBe(false);
  });
});

describe('merging', () => {
  it('sorts, and merges overlapping and touching spans', () => {
    expect(pairs(mergeIntervals([iv(30, 40), iv(0, 10), iv(5, 20), iv(20, 25)]))).toEqual([
      [0, 25],
      [30, 40],
    ]);
  });

  it('absorbs nested spans', () => {
    expect(pairs(mergeIntervals([iv(0, 100), iv(10, 20), iv(30, 40)]))).toEqual([[0, 100]]);
  });

  it('keeps spans that are one minute apart separate', () => {
    expect(pairs(mergeIntervals([iv(0, 10), iv(11, 20)]))).toEqual([
      [0, 10],
      [11, 20],
    ]);
  });

  it('handles an empty list and does not change its input', () => {
    expect(mergeIntervals([])).toEqual([]);
    const input = [iv(30, 40), iv(0, 10)];
    mergeIntervals(input);
    expect(pairs(input)).toEqual([
      [30, 40],
      [0, 10],
    ]);
  });
});

describe('where spans stack', () => {
  it('finds where at least two of three spans overlap', () => {
    expect(pairs(intervalsAtDepth([iv(0, 30), iv(10, 40), iv(35, 50)], 2))).toEqual([
      [10, 30],
      [35, 40],
    ]);
  });

  it('does not stack spans that only touch', () => {
    expect(intervalsAtDepth([iv(0, 10), iv(10, 20)], 2)).toEqual([]);
  });

  it('is the merged list at depth 1 and empty above the number of spans', () => {
    const list = [iv(30, 40), iv(0, 10), iv(5, 20)];
    expect(intervalsAtDepth(list, 1)).toEqual(mergeIntervals(list));
    expect(intervalsAtDepth(list, 4)).toEqual([]);
  });

  it('counts identical spans once each', () => {
    expect(pairs(intervalsAtDepth([iv(0, 10), iv(0, 10), iv(0, 10)], 3))).toEqual([[0, 10]]);
  });
});

describe('intersecting and subtracting', () => {
  it('intersects: keeps only shared time', () => {
    expect(pairs(intersectIntervals([iv(0, 50)], [iv(20, 70)]))).toEqual([[20, 50]]);
    expect(pairs(intersectIntervals([iv(0, 10), iv(20, 30)], [iv(5, 25)]))).toEqual([
      [5, 10],
      [20, 25],
    ]);
  });

  it('gives nothing for spans that only touch', () => {
    expect(intersectIntervals([iv(0, 10)], [iv(10, 20)])).toEqual([]);
  });

  it('subtracts: cuts a hole, trims an end, or removes everything', () => {
    expect(pairs(subtractIntervals([iv(0, 100)], [iv(40, 60)]))).toEqual([
      [0, 40],
      [60, 100],
    ]);
    expect(pairs(subtractIntervals([iv(0, 100)], [iv(90, 120)]))).toEqual([[0, 90]]);
    expect(pairs(subtractIntervals([iv(0, 100)], [iv(0, 100)]))).toEqual([]);
  });

  it('subtracts a removal that spans several members', () => {
    expect(pairs(subtractIntervals([iv(0, 10), iv(20, 30), iv(40, 50)], [iv(5, 45)]))).toEqual([
      [0, 5],
      [45, 50],
    ]);
  });

  it('leaves the list alone when the removal only touches', () => {
    expect(pairs(subtractIntervals([iv(0, 10)], [iv(10, 20)]))).toEqual([[0, 10]]);
  });

  it('is empty for empty inputs', () => {
    expect(subtractIntervals([], [iv(0, 10)])).toEqual([]);
    expect(pairs(subtractIntervals([iv(0, 10)], []))).toEqual([[0, 10]]);
  });
});

describe('looking up a normalized list', () => {
  const list = [iv(0, 60), iv(120, 180)];

  it('covers a target that lies inside one member, boundaries included', () => {
    expect(listCovers(list, iv(0, 60))).toBe(true);
    expect(listCovers(list, iv(30, 40))).toBe(true);
    expect(listCovers(list, iv(120, 121))).toBe(true);
  });

  it('does not cover a target that exceeds a member by a minute or spans the gap', () => {
    expect(listCovers(list, iv(30, 61))).toBe(false);
    expect(listCovers(list, iv(59, 121))).toBe(false);
    expect(listCovers(list, iv(60, 120))).toBe(false);
    expect(listCovers([], iv(0, 10))).toBe(false);
  });

  it('reports overlap with any member, and none for a touching target', () => {
    expect(listOverlaps(list, iv(50, 70))).toBe(true);
    expect(listOverlaps(list, iv(60, 120))).toBe(false);
    expect(listOverlaps(list, iv(179, 200))).toBe(true);
    expect(listOverlaps(list, iv(180, 200))).toBe(false);
    expect(listOverlaps(list, iv(0, 1))).toBe(true);
    expect(listOverlaps([], iv(0, 10))).toBe(false);
  });
});

describe('interval algebra against a minute-by-minute model', () => {
  const HORIZON = 48;

  /** A deterministic generator, so a failure reproduces. */
  function random(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomList(next: () => number): TimeInterval[] {
    const count = Math.floor(next() * 5);
    return Array.from({ length: count }, () => {
      const from = Math.floor(next() * (HORIZON - 1));
      const to = from + 1 + Math.floor(next() * (HORIZON - from - 1));
      return iv(from, to);
    });
  }

  function bitsOf(list: readonly TimeInterval[]): boolean[] {
    const bits = Array.from({ length: HORIZON }, () => false);
    for (const [from, to] of pairs(list)) {
      for (let minute = from; minute < to; minute += 1) {
        bits[minute] = true;
      }
    }
    return bits;
  }

  function runsOf(bits: readonly boolean[]): Array<[number, number]> {
    const runs: Array<[number, number]> = [];
    let start: number | null = null;
    bits.forEach((isSet, minute) => {
      if (isSet && start === null) {
        start = minute;
      }
      if (!isSet && start !== null) {
        runs.push([start, minute]);
        start = null;
      }
    });
    if (start !== null) {
      runs.push([start, HORIZON]);
    }
    return runs;
  }

  it('agrees on merge, intersect, subtract, covers and overlaps for 400 random cases', () => {
    const next = random(20270111);
    for (let round = 0; round < 400; round += 1) {
      const a = mergeIntervals(randomList(next));
      const b = mergeIntervals(randomList(next));
      const bitsA = bitsOf(a);
      const bitsB = bitsOf(b);

      expect(pairs(a)).toEqual(runsOf(bitsA));
      expect(pairs(intersectIntervals(a, b))).toEqual(
        runsOf(bitsA.map((isSet, minute) => isSet && bitsB[minute] === true)),
      );
      expect(pairs(subtractIntervals(a, b))).toEqual(
        runsOf(bitsA.map((isSet, minute) => isSet && bitsB[minute] !== true)),
      );

      const target = randomList(next)[0];
      if (target !== undefined) {
        const [from, to] = pairs([target])[0] ?? [0, 0];
        const covered = bitsA.slice(from, to);
        expect(listCovers(a, target)).toBe(covered.every(Boolean));
        expect(listOverlaps(a, target)).toBe(covered.some(Boolean));
      }
    }
  });

  it('agrees on where spans stack for 400 random cases', () => {
    const next = random(20271026);
    for (let round = 0; round < 400; round += 1) {
      const spans = [...randomList(next), ...randomList(next)];
      const depth = 1 + Math.floor(next() * 3);
      const counts = Array.from({ length: HORIZON }, () => 0);
      for (const [from, to] of pairs(spans)) {
        for (let minute = from; minute < to; minute += 1) {
          counts[minute] = (counts[minute] ?? 0) + 1;
        }
      }
      expect(pairs(intervalsAtDepth(spans, depth))).toEqual(
        runsOf(counts.map((count) => count >= depth)),
      );
    }
  });
});
