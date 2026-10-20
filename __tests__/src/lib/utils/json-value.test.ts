import { describe, expect, it } from 'vitest';

import { isJsonRecord, isJsonValue, jsonWeight } from '@lib/utils/json-value';

describe('isJsonValue', () => {
  it.each([null, 'a', '', true, false, 0, -1.5, [], {}, [1, 'a', null, { b: [true] }]])(
    'accepts %j',
    (value) => {
      expect(isJsonValue(value)).toBe(true);
    },
  );

  it.each([
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    10n,
    Symbol('x'),
    () => 1,
    new Date(),
    new Map(),
    [undefined],
    { a: undefined },
    { a: () => 1 },
    [new Date()],
  ])('rejects %s', (value) => {
    expect(isJsonValue(value)).toBe(false);
  });

  it('bounds nesting: the value itself is level 1', () => {
    expect(isJsonValue('a', 1)).toBe(true);
    expect(isJsonValue('a', 0)).toBe(false);
    expect(isJsonValue([1], 2)).toBe(true);
    expect(isJsonValue([[1]], 2)).toBe(false);
    expect(isJsonValue({ a: { b: 1 } }, 3)).toBe(true);
    expect(isJsonValue({ a: { b: 1 } }, 2)).toBe(false);
  });

  it('answers a very deep value without exhausting the stack, given a limit', () => {
    let deep: unknown = 'leaf';
    for (let level = 0; level < 100_000; level += 1) {
      deep = [deep];
    }

    expect(isJsonValue(deep, 50)).toBe(false);
  });
});

describe('isJsonRecord', () => {
  it('accepts a plain object of JSON values', () => {
    expect(isJsonRecord({ a: 1, b: { c: [null] } })).toBe(true);
    expect(isJsonRecord({})).toBe(true);
  });

  it.each([null, [], 'a', 1, new Map(), { a: undefined }, { a: Number.NaN }])(
    'rejects %j',
    (value) => {
      expect(isJsonRecord(value)).toBe(false);
    },
  );

  it('does not count the record itself as a level', () => {
    expect(isJsonRecord({ a: 1 }, 1)).toBe(true);
    expect(isJsonRecord({ a: [1] }, 1)).toBe(false);
    expect(isJsonRecord({ a: [1] }, 2)).toBe(true);
  });
});

describe('jsonWeight', () => {
  it('weighs a scalar 1, and a string 1 plus its length', () => {
    expect(jsonWeight(null)).toBe(1);
    expect(jsonWeight(true)).toBe(1);
    expect(jsonWeight(42)).toBe(1);
    expect(jsonWeight('abc')).toBe(4);
    expect(jsonWeight('')).toBe(1);
  });

  it('adds the weight of every element of an array to its own 1', () => {
    expect(jsonWeight([])).toBe(1);
    expect(jsonWeight(['ab', 1])).toBe(1 + 3 + 1);
  });

  it('adds key lengths and member weights for an object', () => {
    expect(jsonWeight({})).toBe(1);
    expect(jsonWeight({ ab: 'c' })).toBe(1 + 2 + 2);
  });

  it('grows with the content, so it can bound untrusted input', () => {
    expect(jsonWeight({ a: 'x'.repeat(1000) })).toBeGreaterThan(1000);
  });
});
