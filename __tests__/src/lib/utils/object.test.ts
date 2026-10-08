import { describe, expect, it } from 'vitest';

import {
  deepEqual,
  deepMerge,
  hasOwnKey,
  isPlainObject,
  mapValues,
  omit,
  omitUndefined,
  pick,
} from '@lib/utils/object';

describe('isPlainObject', () => {
  it('accepts plain objects and null-prototype objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
  });

  it('rejects arrays, dates, class instances, and null', () => {
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(new Date())).toBe(false);
    expect(isPlainObject(new (class Foo {})())).toBe(false);
    expect(isPlainObject(null)).toBe(false);
  });
});

describe('hasOwnKey', () => {
  it('ignores inherited keys', () => {
    expect(hasOwnKey({ a: 1 }, 'a')).toBe(true);
    expect(hasOwnKey({ a: 1 }, 'toString')).toBe(false);
  });
});

describe('omitUndefined', () => {
  it('drops undefined but keeps null and falsy values', () => {
    expect(omitUndefined({ a: undefined, b: null, c: 0, d: '' })).toEqual({
      b: null,
      c: 0,
      d: '',
    });
  });
});

describe('pick and omit', () => {
  const source = { a: 1, b: 2, c: 3 };

  it('picks listed keys', () => {
    expect(pick(source, ['a', 'c'])).toEqual({ a: 1, c: 3 });
  });

  it('omits listed keys', () => {
    expect(omit(source, ['b'])).toEqual({ a: 1, c: 3 });
  });
});

describe('mapValues', () => {
  it('maps values and keeps keys', () => {
    expect(mapValues({ a: 1, b: 2 }, (v) => v * 2)).toEqual({ a: 2, b: 4 });
  });
});

describe('deepEqual', () => {
  it('compares nested structures', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
  });

  it('distinguishes key sets and array lengths', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(deepEqual([1, 2], [1])).toBe(false);
  });

  it('treats NaN as equal to itself', () => {
    expect(deepEqual(Number.NaN, Number.NaN)).toBe(true);
  });
});

describe('deepMerge', () => {
  it('merges nested plain objects and replaces arrays', () => {
    const result = deepMerge({ a: { x: 1, y: 2 }, list: [1, 2] }, { a: { y: 3 }, list: [9] });
    expect(result).toEqual({ a: { x: 1, y: 3 }, list: [9] });
  });

  it('does not mutate its inputs', () => {
    const target = { a: { x: 1 } };
    deepMerge(target, { a: { x: 2 } });
    expect(target).toEqual({ a: { x: 1 } });
  });
});
