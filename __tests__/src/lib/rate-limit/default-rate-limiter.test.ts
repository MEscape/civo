import { describe, expect, it } from 'vitest';

import { getRateLimiter } from '@lib/rate-limit/default-rate-limiter';
import type { RateLimitPolicy } from '@lib/rate-limit/rate-limit-policy';

const POLICY: RateLimitPolicy = {
  id: 'default-wiring.smoke',
  limit: 2,
  windowSeconds: 60,
  onBackendFailure: 'deny',
};

describe('getRateLimiter (the real wiring, in the test environment: memory backend)', () => {
  it('is cheap to obtain and builds nothing until it is used', () => {
    expect(() => getRateLimiter()).not.toThrow();
  });

  it('counts and refuses end to end through the configured store', async () => {
    const limiter = getRateLimiter();
    const subject = { kind: 'identifier', value: `smoke-${Date.now()}@example.org` } as const;

    const results = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      results.push(await limiter.enforce({ policy: POLICY, subject }));
    }

    expect(results.map((result) => result.isOk())).toEqual([true, true, false]);
    expect(results[2]?.isErr() && results[2].error.kind).toBe('rate_limited');
  });

  it('supports a composite and never throws for an invalid request', async () => {
    const limiter = getRateLimiter();

    const composite = await limiter.enforceAll([
      { policy: { ...POLICY, id: 'default-wiring.a' }, subject: { kind: 'global' } },
      { policy: { ...POLICY, id: 'default-wiring.b' }, subject: { kind: 'global' } },
    ]);
    const invalid = await limiter.enforce({
      policy: { ...POLICY, limit: 0 },
      subject: { kind: 'global' },
    });

    expect(composite.isOk()).toBe(true);
    expect(invalid.isErr() && invalid.error.code).toBe('rate_limit.invalid_request');
  });
});
