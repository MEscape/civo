import { describe, expect, it } from 'vitest';

import {
  getPath,
  hasUnsafePathSegment,
  isUnsafePathSegment,
  normalizePath,
  pathSegments,
  setPath,
} from '@lib/utils/path';

describe('isUnsafePathSegment', () => {
  it.each(['__proto__', 'prototype', 'constructor'])('flags %s', (segment) => {
    expect(isUnsafePathSegment(segment)).toBe(true);
  });

  it('lets an ordinary segment through', () => {
    expect(isUnsafePathSegment('name')).toBe(false);
  });
});

describe('normalizePath', () => {
  it('turns bracket indexes into dot form', () => {
    expect(normalizePath('items[0].tags[12]')).toBe('items.0.tags.12');
  });

  it('leaves other brackets alone', () => {
    expect(normalizePath('a[b]')).toBe('a[b]');
  });
});

describe('pathSegments', () => {
  it('splits dots and brackets and drops empty segments', () => {
    expect(pathSegments('a..b[2].c')).toEqual(['a', 'b', '2', 'c']);
  });

  it('is empty for the empty path', () => {
    expect(pathSegments('')).toEqual([]);
  });
});

describe('hasUnsafePathSegment', () => {
  it('finds an unsafe segment anywhere in the path', () => {
    expect(hasUnsafePathSegment('a.__proto__.b')).toBe(true);
    expect(hasUnsafePathSegment('constructor')).toBe(true);
    expect(hasUnsafePathSegment('items[0].prototype')).toBe(true);
  });

  it('accepts a safe path', () => {
    expect(hasUnsafePathSegment('a.b[0].c')).toBe(false);
  });
});

describe('getPath', () => {
  const data = { a: { b: [{ c: 1 }], n: null } };

  it('reads nested objects and array indexes', () => {
    expect(getPath(data, 'a.b.0.c')).toBe(1);
  });

  it('returns the whole structure at a prefix', () => {
    expect(getPath(data, 'a.b')).toEqual([{ c: 1 }]);
  });

  it('is undefined for a missing segment, a null on the way, or a primitive on the way', () => {
    expect(getPath(data, 'a.x.y')).toBeUndefined();
    expect(getPath(data, 'a.n.y')).toBeUndefined();
    expect(getPath(data, 'a.b.0.c.d')).toBeUndefined();
    expect(getPath(null, 'a')).toBeUndefined();
  });

  it('does not find a member inherited from the prototype', () => {
    expect(getPath({}, 'constructor')).toBeUndefined();
    expect(getPath({}, '__proto__')).toBeUndefined();
    expect(getPath({ a: {} }, 'a.toString')).toBeUndefined();
  });
});

describe('setPath', () => {
  it('replaces a value and creates missing intermediate objects', () => {
    expect(setPath({ a: 1 }, 'b.c', 2)).toEqual({ a: 1, b: { c: 2 } });
    expect(setPath({ a: { x: 1 } }, 'a.y', 2)).toEqual({ a: { x: 1, y: 2 } });
  });

  it('replaces an intermediate value that is not a plain object', () => {
    expect(setPath({ a: 5 }, 'a.b', 1)).toEqual({ a: { b: 1 } });
  });

  it('never mutates its input', () => {
    const input = { a: { x: 1 } };

    setPath(input, 'a.x', 2);

    expect(input).toEqual({ a: { x: 1 } });
  });

  it('sets a key named "" for the empty path', () => {
    expect(setPath({}, '', 1)).toEqual({ '': 1 });
  });

  it.each(['__proto__.polluted', 'a.constructor.prototype.polluted', 'prototype'])(
    'refuses the unsafe path %s and pollutes nothing',
    (path) => {
      expect(() => setPath({}, path, true)).toThrow('Unsafe path segment');
      expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    },
  );
});
