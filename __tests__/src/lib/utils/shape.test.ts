import { describe, expect, it } from 'vitest';

import {
  arrayOf,
  isBoolean,
  isFiniteNumber,
  isInteger,
  isString,
  nullable,
  objectOf,
  oneOf,
  optional,
} from '@lib/utils/shape';

describe('primitive guards', () => {
  it('isString accepts strings only', () => {
    expect([isString(''), isString('a')]).toEqual([true, true]);
    expect([isString(1), isString(null), isString(undefined), isString(['a'])]).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it('isBoolean accepts true and false only', () => {
    expect([isBoolean(true), isBoolean(false)]).toEqual([true, true]);
    expect([isBoolean(0), isBoolean('true'), isBoolean(null)]).toEqual([false, false, false]);
  });

  it('isFiniteNumber refuses NaN, the infinities and non-numbers', () => {
    expect([isFiniteNumber(0), isFiniteNumber(-1.5)]).toEqual([true, true]);
    expect([
      isFiniteNumber(Number.NaN),
      isFiniteNumber(Number.POSITIVE_INFINITY),
      isFiniteNumber('1'),
    ]).toEqual([false, false, false]);
  });

  it('isInteger accepts whole numbers only', () => {
    expect([isInteger(3), isInteger(-3), isInteger(0)]).toEqual([true, true, true]);
    expect([isInteger(1.5), isInteger(Number.NaN), isInteger('1'), isInteger(null)]).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('arrayOf', () => {
  const isStrings = arrayOf(isString);

  it('accepts an array whose every element passes, and the empty array', () => {
    expect(isStrings(['a', 'b'])).toBe(true);
    expect(isStrings([])).toBe(true);
  });

  it('rejects one bad element and non-arrays', () => {
    expect(isStrings(['a', 1])).toBe(false);
    expect(isStrings('ab')).toBe(false);
    expect(isStrings({ length: 0 })).toBe(false);
  });
});

describe('nullable and optional', () => {
  it('nullable accepts null as well', () => {
    const guard = nullable(isString);

    expect([guard(null), guard('a')]).toEqual([true, true]);
    expect([guard(undefined), guard(1)]).toEqual([false, false]);
  });

  it('optional accepts undefined as well', () => {
    const guard = optional(isString);

    expect([guard(undefined), guard('a')]).toEqual([true, true]);
    expect([guard(null), guard(1)]).toEqual([false, false]);
  });
});

describe('oneOf', () => {
  const isStatus = oneOf(['draft', 'live'] as const);

  it('accepts the listed literals only', () => {
    expect(isStatus('live')).toBe(true);
    expect(isStatus('archived')).toBe(false);
    expect(isStatus(1)).toBe(false);
  });
});

describe('objectOf', () => {
  interface Row {
    id: string;
    count: number;
    note?: string | undefined;
  }
  const isRow = objectOf<Row>({ id: isString, count: isFiniteNumber, note: optional(isString) });

  it('accepts an object with every member right, ignoring extra columns', () => {
    expect(isRow({ id: 'a', count: 1 })).toBe(true);
    expect(isRow({ id: 'a', count: 1, note: 'n', extra: true })).toBe(true);
  });

  it('rejects a missing or wrong member', () => {
    expect(isRow({ id: 'a' })).toBe(false);
    expect(isRow({ id: 1, count: 1 })).toBe(false);
    expect(isRow({ id: 'a', count: 1, note: 5 })).toBe(false);
  });

  it('rejects what is not an object', () => {
    expect(isRow(null)).toBe(false);
    expect(isRow('row')).toBe(false);
    expect(isRow(undefined)).toBe(false);
  });
});
