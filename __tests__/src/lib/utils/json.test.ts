import { describe, expect, it } from 'vitest';

import {
  JsonParseError,
  JsonStringifyError,
  parseJson,
  stableStringify,
  stringifyJson,
} from '@lib/utils/json';

describe('parseJson', () => {
  it('parses valid JSON strings', () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseJson('[1, 2, 3]')).toEqual([1, 2, 3]);
    expect(parseJson('"string"')).toBe('string');
  });

  it('throws JsonParseError, keeping the SyntaxError as its cause', () => {
    expect.assertions(3);
    try {
      parseJson('{ invalid }');
    } catch (error) {
      expect(error).toBeInstanceOf(JsonParseError);
      expect((error as JsonParseError).name).toBe('JsonParseError');
      expect((error as JsonParseError).cause).toBeInstanceOf(SyntaxError);
    }
  });
});

describe('stringifyJson', () => {
  it('serializes standard JSON values', () => {
    expect(stringifyJson({ a: 1 })).toBe('{"a":1}');
    expect(stringifyJson([1, 'two', null])).toBe('[1,"two",null]');
    expect(stringifyJson('x')).toBe('"x"');
  });

  it('indents when asked', () => {
    expect(stringifyJson({ a: 1 }, 2)).toBe('{\n  "a": 1\n}');
  });

  it('throws JsonStringifyError on a cycle, keeping the cause', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;

    expect.assertions(3);
    try {
      stringifyJson(cyclic);
    } catch (error) {
      expect(error).toBeInstanceOf(JsonStringifyError);
      expect((error as JsonStringifyError).name).toBe('JsonStringifyError');
      expect((error as JsonStringifyError).cause).toBeInstanceOf(TypeError);
    }
  });

  it('throws on a BigInt', () => {
    expect(() => stringifyJson({ n: 10n })).toThrow(JsonStringifyError);
  });

  it.each([undefined, () => 1, Symbol('x')])('throws for %j, which has no JSON form', (value) => {
    expect(() => stringifyJson(value)).toThrow('Value is not serializable');
  });
});

describe('stableStringify', () => {
  it('writes plain-object keys in sorted order, at every depth', () => {
    expect(stableStringify({ b: 1, a: { d: 1, c: 2 } })).toBe('{"a":{"c":2,"d":1},"b":1}');
  });

  it('gives structurally equal values the same text, whatever the key order', () => {
    expect(stableStringify({ x: 1, y: [1, { q: 1, p: 2 }] })).toBe(
      stableStringify({ y: [1, { p: 2, q: 1 }], x: 1 }),
    );
  });

  it('keeps array order', () => {
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]');
  });

  it('omits undefined object entries and writes them as null inside arrays', () => {
    expect(stableStringify({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(stableStringify([undefined, 1])).toBe('[null,1]');
  });

  it('writes primitives like JSON.stringify', () => {
    expect(stableStringify('a"b')).toBe('"a\\"b"');
    expect(stableStringify(1)).toBe('1');
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(true)).toBe('true');
  });

  it('writes a value with no JSON form as null', () => {
    expect(stableStringify(undefined)).toBe('null');
    expect(stableStringify(() => 1)).toBe('null');
  });

  it('hands a Date to JSON.stringify, which writes its ISO string', () => {
    expect(stableStringify({ at: new Date('2026-01-01T00:00:00Z') })).toBe(
      '{"at":"2026-01-01T00:00:00.000Z"}',
    );
  });

  it('escapes keys', () => {
    expect(stableStringify({ 'a"b': 1 })).toBe('{"a\\"b":1}');
  });

  it('is pinned: ids derived from it are stored', () => {
    expect(stableStringify({ type: 'hero', props: { title: 'Hi', size: 2 }, children: [] })).toBe(
      '{"children":[],"props":{"size":2,"title":"Hi"},"type":"hero"}',
    );
  });
});
