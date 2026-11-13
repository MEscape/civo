import { describe, expect, it } from 'vitest';

import { getRateLimiter } from '@lib/rate-limit/default-rate-limiter';
import type { RateLimitPolicy } from '@lib/rate-limit/rate-limit-policy';

const POLICY: RateLimitPolicy = {
  id: 'default-wiring.smoke',
  limit: 2,
  windowSeconds: 60,
  onBackendFailure: 'deny',
};

// vitest.config.ts sets RATE_LIMIT_ENABLED=false, so unit tests never reach Redis.
describe('getRateLimiter (the real wiring, in the test environment: rate limiting disabled)', () => {
  it('is cheap to obtain and builds nothing until it is used', () => {
    expect(() => getRateLimiter()).not.toThrow();
  });

  it('allows every attempt without counting, however often it is repeated', async () => {
    const limiter = getRateLimiter();
    const subject = { kind: 'identifier', value: 'smoke@example.org' } as const;

    const results = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      results.push(await limiter.enforce({ policy: POLICY, subject }));
    }

    expect(results.map((result) => result.isOk())).toEqual([true, true, true, true, true]);
    expect(results[0]?.isOk() && results[0].value).toEqual({
      limit: 2,
      remaining: null,
      resetAfterSeconds: null,
      degraded: false,
    });
  });

  it('allows a composite as well', async () => {
    const composite = await getRateLimiter().enforceAll([
      { policy: { ...POLICY, id: 'default-wiring.a' }, subject: { kind: 'global' } },
      { policy: { ...POLICY, id: 'default-wiring.b' }, subject: { kind: 'global' } },
    ]);

    expect(composite.isOk() && composite.value).toHaveLength(2);
  });
});
