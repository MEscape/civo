import { describe, expect, it } from 'vitest';

import {
  changedKeys,
  deepEqual,
  deepMerge,
  definedKeys,
  hasOwnKey,
  isPlainObject,
  omit,
  pick,
} from '@lib/utils/object';

describe('isPlainObject', () => {
  it('accepts plain objects and null-prototype objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
  });

  it.each([null, undefined, 1, 'a', [], new Date(), new Map(), () => undefined])(
    'rejects %j',
    (value) => {
      expect(isPlainObject(value)).toBe(false);
    },
  );

  it('rejects a class instance', () => {
    expect(isPlainObject(new (class Box {})())).toBe(false);
  });
});

describe('hasOwnKey', () => {
  it('sees own keys only, not inherited ones', () => {
    expect(hasOwnKey({ a: 1 }, 'a')).toBe(true);
    expect(hasOwnKey({ a: 1 }, 'toString')).toBe(false);
  });
});

describe('pick', () => {
  it('keeps only the listed own keys', () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 });
  });

  it('skips a listed key the object lacks', () => {
    const partial: { a: number; b?: number } = { a: 1 };

    expect(pick(partial, ['a', 'b'])).toEqual({ a: 1 });
  });
});

describe('omit', () => {
  it('drops the listed keys and keeps the rest', () => {
    expect(omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 });
  });

  it('does not change its input', () => {
    const input = { a: 1, b: 2 };

    omit(input, ['a']);

    expect(input).toEqual({ a: 1, b: 2 });
  });
});

describe('deepEqual', () => {
  it('compares nested plain data by value', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
  });

  it('treats NaN as equal to NaN', () => {
    expect(deepEqual(Number.NaN, Number.NaN)).toBe(true);
  });

  it('tells arrays of different length apart', () => {
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it('tells objects with different keys apart, even with equal key counts', () => {
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('does not equate an undefined member with a missing one', () => {
    expect(deepEqual({ a: undefined }, {})).toBe(false);
  });

  it('does not equate an array with an object, or values of different kinds', () => {
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual(1, '1')).toBe(false);
  });

  it('compares non-plain objects by identity', () => {
    expect(deepEqual(new Date(0), new Date(0))).toBe(false);
  });
});

describe('deepMerge', () => {
  it('merges nested plain objects, the source winning', () => {
    expect(deepMerge({ a: { x: 1, y: 1 }, b: 1 }, { a: { y: 2, z: 3 }, c: 4 })).toEqual({
      a: { x: 1, y: 2, z: 3 },
      b: 1,
      c: 4,
    });
  });

  it('replaces arrays and non-plain values instead of merging them', () => {
    expect(deepMerge({ list: [1, 2], when: new Date(0) }, { list: [3] })).toEqual({
      list: [3],
      when: new Date(0),
    });
    expect(deepMerge({ a: { x: 1 } }, { a: [1] })).toEqual({ a: [1] });
  });

  it('does not change either input', () => {
    const target = { a: { x: 1 } };
    const source = { a: { y: 2 } };

    deepMerge(target, source);

    expect(target).toEqual({ a: { x: 1 } });
    expect(source).toEqual({ a: { y: 2 } });
  });

  it('keeps a __proto__ key from data as an ordinary key, never as the prototype', () => {
    const hostile = JSON.parse('{"__proto__": {"isAdmin": true}, "name": "x"}') as Record<
      string,
      unknown
    >;

    const merged = deepMerge({ a: 1 }, hostile);

    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect((merged as { isAdmin?: boolean }).isAdmin).toBeUndefined();
    expect(Object.hasOwn(merged, '__proto__')).toBe(true);
    expect(({} as { isAdmin?: boolean }).isAdmin).toBeUndefined();
  });
});

describe('definedKeys', () => {
  it('lists keys whose value is not undefined; null counts', () => {
    expect(definedKeys({ a: 1, b: undefined, c: null, d: 0 })).toEqual(['a', 'c', 'd']);
  });
});

describe('changedKeys', () => {
  it('lists keys that differ, including keys on one side only', () => {
    expect(changedKeys({ a: 1, b: 2, c: 3 }, { a: 1, b: 3, d: 4 }).sort()).toEqual(['b', 'c', 'd']);
  });

  it('compares nested values by content', () => {
    expect(changedKeys({ a: { x: [1] } }, { a: { x: [1] } })).toEqual([]);
  });

  it('counts a missing key and an undefined one as the same', () => {
    expect(changedKeys({ a: undefined }, {})).toEqual([]);
  });

  it('does not read a value inherited from the prototype', () => {
    // `toString` is a function on every object, but neither record has it as its own.
    expect(changedKeys({}, { toString: undefined })).toEqual([]);
  });
});
