import type { Clock } from '@lib/clock';
import { createRateLimiter } from '@lib/rate-limit';
import type { ClientAddressProvider, RateLimiter } from '@lib/rate-limit';

import { InMemoryRateLimitStore } from '../lib/rate-limit/in-memory-rate-limit-store';

const FIXED_CLOCK: Clock = { now: () => new Date('2026-10-28T10:00:00Z') };

/** Uses the real limiter with a deterministic store; no network or process-global counters. */
export function createTestRateLimiter(clock: Clock = FIXED_CLOCK): RateLimiter {
  return createRateLimiter({
    store: new InMemoryRateLimitStore(clock),
    keySecret: 'test-rate-limit-secret'.repeat(2),
    clock,
    timeoutMs: 1_000,
    log: { info: () => undefined, warn: () => undefined, error: () => undefined },
  });
}

export function clientAt(address: string): ClientAddressProvider {
  return { current: () => Promise.resolve({ kind: 'client', address }) };
}

export const UNRESOLVED_CLIENT: ClientAddressProvider = {
  current: () => Promise.resolve({ kind: 'unresolved-client' }),
};
