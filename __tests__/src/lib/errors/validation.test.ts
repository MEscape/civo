import { describe, expect, expectTypeOf, it } from 'vitest';

import { fieldPath, ROOT_FIELD } from '@lib/errors/validation';
import type { NestedKeyOf } from '@lib/errors/validation';

describe('fieldPath', () => {
  it('joins segments with dots, the format react-hook-form expects', () => {
    expect(fieldPath('children', 0, 'props')).toBe('children.0.props');
  });

  it('is a single segment for one, and empty for none', () => {
    expect(fieldPath('title')).toBe('title');
    expect(fieldPath()).toBe('');
  });

  it('is typed as the literal path', () => {
    expectTypeOf(fieldPath('a', 'b')).toEqualTypeOf<'a.b'>();
  });
});

describe('ROOT_FIELD', () => {
  it('is the key for problems that belong to no single field', () => {
    expect(ROOT_FIELD).toBe('_form');
  });
});

describe('NestedKeyOf', () => {
  it('lists every dotted path of an object type', () => {
    interface Shape {
      a: { b: number };
      c: string;
    }

    expectTypeOf<NestedKeyOf<Shape>>().toEqualTypeOf<'a' | 'a.b' | 'c'>();
  });
});
