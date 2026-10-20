import { describe, expect, it } from 'vitest';

import { assertNever, invariant } from '@lib/utils/assert';

describe('assertNever', () => {
  it('throws, naming the unexpected value', () => {
    expect(() => assertNever('surprise' as never)).toThrow('Unexpected value: "surprise"');
  });

  it('uses the given message instead', () => {
    expect(() => assertNever('x' as never, 'Unsupported provider.')).toThrow(
      'Unsupported provider.',
    );
  });

  it('can describe a value JSON cannot, instead of throwing something else', () => {
    expect(() => assertNever(10n as never)).toThrow('Unexpected value: 10');
    expect(() => assertNever(undefined as never)).toThrow('Unexpected value: undefined');

    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(() => assertNever(cyclic as never)).toThrow('Unexpected value: [object Object]');
  });
});

describe('invariant', () => {
  it('does nothing while the condition holds', () => {
    expect(() => {
      invariant(1 + 1 === 2, 'arithmetic');
    }).not.toThrow();
  });

  it.each([false, 0, '', null, undefined])('throws for the falsy %j', (condition) => {
    expect(() => {
      invariant(condition, 'MAIL_FROM is required.');
    }).toThrow('Invariant violation: MAIL_FROM is required.');
  });
});
