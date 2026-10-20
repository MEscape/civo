import { describe, expect, it } from 'vitest';

import { toJsonValue } from '@lib/db/json-value';
import { JsonStringifyError } from '@lib/utils';

describe('toJsonValue', () => {
  it('returns plain JSON equal to what the database will hold', () => {
    const readonlyValue = Object.freeze({ title: 'Hi', tags: Object.freeze(['a']) });

    expect(toJsonValue(readonlyValue)).toEqual({ title: 'Hi', tags: ['a'] });
  });

  it('drops undefined members and turns a Date into its ISO text', () => {
    expect(toJsonValue({ a: undefined, at: new Date('2026-01-01T00:00:00Z') })).toEqual({
      at: '2026-01-01T00:00:00.000Z',
    });
  });

  it('returns a copy, not the input', () => {
    const input = { a: [1] };

    expect(toJsonValue(input)).not.toBe(input);
  });

  it('throws JsonStringifyError for a bigint, which has no JSON form', () => {
    expect(() => toJsonValue({ value: 10n })).toThrow(JsonStringifyError);
  });

  it('throws JsonStringifyError for a cycle', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;

    expect(() => toJsonValue(cyclic)).toThrow(JsonStringifyError);
  });
});
