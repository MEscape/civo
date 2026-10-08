import { describe, expect, it } from 'vitest';

import { assertNever, invariant } from '@lib/utils/assert';

describe('assertNever', () => {
  it('throws with the unexpected value', () => {
    expect(() => assertNever('x' as never)).toThrow('Unexpected value: "x"');
  });

  it('accepts a custom message', () => {
    expect(() => assertNever('x' as never, 'custom')).toThrow('custom');
  });
});

describe('invariant', () => {
  it('passes for truthy conditions', () => {
    expect(() => {
      invariant(true, 'ok');
    }).not.toThrow();
  });

  it('throws for falsy conditions with a prefixed message', () => {
    expect(() => {
      invariant(false, 'must hold');
    }).toThrow('Invariant violation: must hold');
  });
});
