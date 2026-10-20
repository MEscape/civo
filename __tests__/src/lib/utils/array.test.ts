import { describe, expect, it } from 'vitest';

import {
  groupBy,
  insertItem,
  isDefined,
  keyBy,
  literalGuard,
  range,
  removeAt,
  replaceAt,
  unique,
} from '@lib/utils/array';

describe('isDefined', () => {
  it('removes null and undefined but keeps falsy values', () => {
    expect([0, '', false, null, undefined].filter(isDefined)).toEqual([0, '', false]);
  });
});

describe('groupBy', () => {
  it('groups in first-seen key order and keeps the order inside a group', () => {
    const groups = groupBy([1, 2, 3, 4, 5], (n) => n % 2);

    expect([...groups]).toEqual([
      [1, [1, 3, 5]],
      [0, [2, 4]],
    ]);
  });

  it('is empty for no items', () => {
    expect(groupBy([], () => 'x').size).toBe(0);
  });

  it('keeps a key named like a prototype member an ordinary key', () => {
    expect(groupBy(['a', 'b'], () => 'constructor').get('constructor')).toEqual(['a', 'b']);
  });
});

describe('keyBy', () => {
  it('indexes by key, the last item winning a collision', () => {
    const index = keyBy(
      [
        { id: 'a', n: 1 },
        { id: 'b', n: 2 },
        { id: 'a', n: 3 },
      ],
      (item) => item.id,
    );

    expect(index.get('a')?.n).toBe(3);
    expect(index.size).toBe(2);
  });
});

describe('unique', () => {
  it('removes duplicates, first occurrence winning', () => {
    expect(unique([3, 1, 3, 2, 1])).toEqual([3, 1, 2]);
  });

  it('compares by a derived key when given one', () => {
    const items = [
      { id: 1, v: 'a' },
      { id: 1, v: 'b' },
      { id: 2, v: 'c' },
    ];

    expect(unique(items, (item) => item.id)).toEqual([
      { id: 1, v: 'a' },
      { id: 2, v: 'c' },
    ]);
  });

  it('does not change its input', () => {
    const input = [1, 1];

    unique(input);

    expect(input).toEqual([1, 1]);
  });
});

describe('range', () => {
  it('counts up to, not including, the end', () => {
    expect(range(2, 5)).toEqual([2, 3, 4]);
  });

  it('is empty when the end is not past the start', () => {
    expect(range(5, 5)).toEqual([]);
    expect(range(5, 2)).toEqual([]);
  });

  it('rounds a fractional length up', () => {
    expect(range(0, 2.5)).toEqual([0, 1, 2]);
  });
});

describe('literalGuard', () => {
  const isRole = literalGuard(['admin', 'viewer'] as const);

  it('accepts the listed literals only', () => {
    expect(isRole('admin')).toBe(true);
    expect(isRole('viewer')).toBe(true);
    expect(isRole('root')).toBe(false);
  });

  it('does not find a prototype member', () => {
    expect(isRole('toString')).toBe(false);
  });
});

describe('insertItem', () => {
  it('inserts at an index, shifting the rest', () => {
    expect(insertItem(['a', 'c'], 1, 'b')).toEqual(['a', 'b', 'c']);
  });

  it('clamps an index outside the list', () => {
    expect(insertItem(['a'], -3, 'x')).toEqual(['x', 'a']);
    expect(insertItem(['a'], 9, 'x')).toEqual(['a', 'x']);
  });

  it('appends for an index that is not a whole number', () => {
    expect(insertItem(['a'], Number.NaN, 'x')).toEqual(['a', 'x']);
    expect(insertItem(['a'], Number.POSITIVE_INFINITY, 'x')).toEqual(['a', 'x']);
    expect(insertItem(['a'], 0.5, 'x')).toEqual(['a', 'x']);
  });

  it('does not change its input', () => {
    const input = ['a'];

    insertItem(input, 0, 'x');

    expect(input).toEqual(['a']);
  });
});

describe('replaceAt', () => {
  it('replaces one item', () => {
    expect(replaceAt(['a', 'b'], 1, 'x')).toEqual(['a', 'x']);
  });

  it('changes nothing for an index outside the list', () => {
    expect(replaceAt(['a'], 5, 'x')).toEqual(['a']);
    expect(replaceAt(['a'], -1, 'x')).toEqual(['a']);
  });
});

describe('removeAt', () => {
  it('removes one item', () => {
    expect(removeAt(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
  });

  it('changes nothing for an index outside the list', () => {
    expect(removeAt(['a'], 5)).toEqual(['a']);
  });
});
