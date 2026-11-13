import { describe, expect, it } from 'vitest';

import { hasExceededMaxLifetime } from '@modules/auth/domain/models/session-policy';

const SIGNED_IN = new Date('2026-10-28T10:00:00Z');
const LIFETIME_MS = 1_000;

describe('the session lifetime ceiling', () => {
  it('expires at the exact boundary', () => {
    expect(
      hasExceededMaxLifetime(SIGNED_IN, new Date(SIGNED_IN.getTime() + 999), LIFETIME_MS),
    ).toBe(false);
    expect(
      hasExceededMaxLifetime(SIGNED_IN, new Date(SIGNED_IN.getTime() + 1_000), LIFETIME_MS),
    ).toBe(true);
  });

  it('fails closed for invalid timestamps or a session dated in the future', () => {
    expect(hasExceededMaxLifetime(new Date(NaN), SIGNED_IN, LIFETIME_MS)).toBe(true);
    expect(hasExceededMaxLifetime(SIGNED_IN, new Date(NaN), LIFETIME_MS)).toBe(true);
    expect(hasExceededMaxLifetime(new Date(SIGNED_IN.getTime() + 1), SIGNED_IN, LIFETIME_MS)).toBe(
      true,
    );
  });

  it.each([0, -1, NaN, Infinity, -Infinity])('fails closed for invalid ceiling %s', (limit) => {
    expect(hasExceededMaxLifetime(SIGNED_IN, SIGNED_IN, limit)).toBe(true);
  });
});
