import { describe, expect, it } from 'vitest';

import { JsonParseError, JsonStringifyError, parseJson, stringifyJson } from '@lib/utils/json';

describe('parseJson', () => {
  it('parses valid JSON strings', () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseJson('[1, 2, 3]')).toEqual([1, 2, 3]);
    expect(parseJson('"string"')).toBe('string');
  });

  it('throws JsonParseError on malformed input', () => {
    expect(() => parseJson('{ invalid }')).toThrow(JsonParseError);
  });
});

describe('stringifyJson', () => {
  it('serializes standard JSON values', () => {
    expect(stringifyJson({ a: 1 })).toBe('{"a":1}');
    expect(stringifyJson([1, 'two', null])).toBe('[1,"two",null]');
  });

  it('applies indentation when space is provided', () => {
    expect(stringifyJson({ a: 1 }, 2)).toBe('{\n  "a": 1\n}');
  });

  it('throws JsonStringifyError for values that trigger exceptions like BigInt', () => {
    const assertion = expect(() => stringifyJson({ v: 10n }));
    assertion.toThrow(JsonStringifyError);
    assertion.toThrow('Exception during serialization');
  });

  it('throws JsonStringifyError for circular references', () => {
    const cycle: Record<string, unknown> = {};
    cycle['self'] = cycle;

    const assertion = expect(() => stringifyJson(cycle));
    assertion.toThrow(JsonStringifyError);
    assertion.toThrow('Exception during serialization');
  });

  it('throws JsonStringifyError for values that silently serialize to undefined', () => {
    const assertion1 = expect(() => stringifyJson(undefined));
    assertion1.toThrow(JsonStringifyError);
    assertion1.toThrow('Value is not serializable');

    const assertion2 = expect(() => stringifyJson(() => {}));
    assertion2.toThrow(JsonStringifyError);
    assertion2.toThrow('Value is not serializable');
  });
});
