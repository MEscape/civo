import { describe, expect, it } from 'vitest';

import { policyProblem } from '@lib/rate-limit/rate-limit-policy';
import type { RateLimitPolicy } from '@lib/rate-limit/rate-limit-policy';

const VALID: RateLimitPolicy = {
  id: 'auth.sign-in',
  limit: 10,
  windowSeconds: 900,
  onBackendFailure: 'deny',
};

describe('policyProblem', () => {
  it('accepts a well-formed policy', () => {
    expect(policyProblem(VALID)).toBeNull();
  });

  it.each(['signin', 'Auth.sign-in', 'auth.', '.x', 'auth..x', 'auth.sign_in', 'auth.sign in', ''])(
    'rejects the id %j',
    (id) => {
      expect(policyProblem({ ...VALID, id })).toMatch(/id must look like/);
    },
  );

  it('rejects an id longer than 64 characters', () => {
    expect(policyProblem({ ...VALID, id: `auth.${'a'.repeat(60)}` })).toMatch(/id must look like/);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 100_001])(
    'rejects the limit %s',
    (limit) => {
      expect(policyProblem({ ...VALID, limit })).toMatch(/limit must be/);
    },
  );

  it.each([0, -60, 0.5, Number.NaN, 86_401])('rejects the window %s', (windowSeconds) => {
    expect(policyProblem({ ...VALID, windowSeconds })).toMatch(/windowSeconds must be/);
  });

  it.each(['skip', 'deny', undefined])('accepts onUnresolvedClient %s', (mode) => {
    const policy = { ...VALID, onUnresolvedClient: mode } as unknown as RateLimitPolicy;
    expect(policyProblem(policy)).toBeNull();
  });

  it.each(['share', 'allow', '', 0])(
    'rejects onUnresolvedClient %j (no shared bucket for strangers)',
    (mode) => {
      const policy = { ...VALID, onUnresolvedClient: mode } as unknown as RateLimitPolicy;
      expect(policyProblem(policy)).toMatch(/onUnresolvedClient/);
    },
  );

  it('rejects a missing or unknown failure mode (no silent default)', () => {
    const unknownMode = { ...VALID, onBackendFailure: 'open' } as unknown as RateLimitPolicy;
    const missingMode = { id: VALID.id, limit: 1, windowSeconds: 1 } as unknown as RateLimitPolicy;
    expect(policyProblem(unknownMode)).toMatch(/onBackendFailure/);
    expect(policyProblem(missingMode)).toMatch(/onBackendFailure/);
  });
});
