import { describe, expect, it } from 'vitest';

import { arrayOf, isInteger, isString, nullable, objectOf, oneOf, optional } from '@lib/utils';

interface Row {
  readonly id: string;
  readonly tags: string[];
  readonly note: string | null;
  readonly kind: 'a' | 'b';
  readonly size?: number | undefined;
}

const isRow = objectOf<Row>({
  id: isString,
  tags: arrayOf(isString),
  note: nullable(isString),
  kind: oneOf(['a', 'b']),
  size: optional(isInteger),
});

describe('structural guards', () => {
  const valid = { id: 'x', tags: ['t'], note: null, kind: 'a' };

  it('accepts a matching object and ignores extra members', () => {
    expect(isRow({ ...valid, extra: 1 })).toBe(true);
  });

  it('treats an optional member as absent or valid', () => {
    expect(isRow({ ...valid, size: 3 })).toBe(true);
    expect(isRow({ ...valid, size: 1.5 })).toBe(false);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a wrong member type', { ...valid, id: 4 }],
    ['a missing required member', { id: 'x', tags: [], kind: 'a' }],
    ['a bad element', { ...valid, tags: ['t', 2] }],
    ['an unknown literal', { ...valid, kind: 'c' }],
  ])('rejects %s', (_name, value) => {
    expect(isRow(value)).toBe(false);
  });
});
