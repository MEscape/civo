import { describe, expect, it } from 'vitest';

import { cn } from '@lib/utils/cn';

const isOff = Boolean(0);

describe('cn', () => {
  it('joins class names and skips falsy ones', () => {
    expect(cn('a', isOff && 'b', undefined, null, 'c')).toBe('a c');
  });

  it('keeps the last of two conflicting Tailwind utilities', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-sm', { 'text-lg': true })).toBe('text-lg');
  });
});
