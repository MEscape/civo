import { describe, expect, it } from 'vitest';

import {
  chunk,
  groupBy,
  isDefined,
  keyBy,
  moveItem,
  partition,
  range,
  unique,
} from '@lib/utils/array';

describe('isDefined', () => {
  it('removes null and undefined but keeps falsy values', () => {
    expect([0, '', false, null, undefined].filter(isDefined)).toEqual([0, '', false]);
  });
});

describe('groupBy', () => {
  it('groups items and preserves order', () => {
    const result = groupBy([1, 2, 3, 4, 5], (n) => (n % 2 === 0 ? 'even' : 'odd'));
    expect(result.get('odd')).toEqual([1, 3, 5]);
    expect(result.get('even')).toEqual([2, 4]);
  });

  it('is safe with prototype-like keys', () => {
    const result = groupBy(['a'], () => '__proto__');
    expect(result.get('__proto__')).toEqual(['a']);
  });
});

describe('keyBy', () => {
  it('indexes by key and lets the last item win on collision', () => {
    const result = keyBy(
      [
        { id: 1, v: 'a' },
        { id: 1, v: 'b' },
      ],
      (x) => x.id,
    );
    expect(result.get(1)?.v).toBe('b');
  });
});

describe('chunk', () => {
  it('splits into fixed-size chunks with a smaller tail', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns an empty array for empty input', () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it.each([0, -1, 1.5, Number.NaN])('throws for invalid size %s', (size) => {
    expect(() => chunk([1], size)).toThrow(RangeError);
  });
});

describe('unique', () => {
  it('removes primitive duplicates', () => {
    expect(unique([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
  });

  it('dedupes by derived key, first occurrence wins', () => {
    const result = unique(
      [
        { id: 1, n: 'a' },
        { id: 1, n: 'b' },
      ],
      (x) => x.id,
    );
    expect(result).toEqual([{ id: 1, n: 'a' }]);
  });
});

describe('partition', () => {
  it('splits by predicate', () => {
    expect(partition([1, 2, 3, 4], (n) => n > 2)).toEqual([
      [3, 4],
      [1, 2],
    ]);
  });
});

describe('range', () => {
  it('builds a half-open range', () => {
    expect(range(2, 5)).toEqual([2, 3, 4]);
  });

  it('returns empty when end is not after start', () => {
    expect(range(5, 5)).toEqual([]);
    expect(range(5, 2)).toEqual([]);
  });
});

describe('moveItem', () => {
  it('moves an item without mutating the input', () => {
    const input = ['a', 'b', 'c'];
    expect(moveItem(input, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(input).toEqual(['a', 'b', 'c']);
  });

  it('ignores an out-of-range source index', () => {
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });
});
