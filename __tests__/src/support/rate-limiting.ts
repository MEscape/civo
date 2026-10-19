import { systemClock } from '@lib/clock';
import type { Clock } from '@lib/clock';
import type { ClientAddressProvider, RateLimiter } from '@lib/rate-limit';
import { createRateLimiter } from '@lib/rate-limit/create-rate-limiter';
import { InMemoryRateLimitStore } from '@lib/rate-limit/in-memory-rate-limit-store';

const TEST_SECRET = 't'.repeat(32);
const TEST_TIMEOUT_MS = 1000;
const SILENT_LOG = { info: () => undefined, warn: () => undefined, error: () => undefined };

/**
 * The real limiter on process memory, so the policies a use case declares behave in a test as they
 * do in production (the same windows, keys and refusals) without a Redis.
 */
export function createTestRateLimiter(clock: Clock = systemClock): RateLimiter {
  return createRateLimiter({
    store: new InMemoryRateLimitStore(clock),
    keySecret: TEST_SECRET,
    clock,
    timeoutMs: TEST_TIMEOUT_MS,
    log: SILENT_LOG,
  });
}

/** A caller whose address is known, as behind a trusted proxy. */
export function clientAt(address: string): ClientAddressProvider {
  return { current: () => Promise.resolve({ kind: 'client', address }) };
}

/** A caller whose address could not be determined. */
export const UNRESOLVED_CLIENT: ClientAddressProvider = {
  current: () => Promise.resolve({ kind: 'unresolved-client' }),
};

/** A limiter whose store is down, so each policy's `onBackendFailure` decides what happens. */
export function createBrokenRateLimiter(): RateLimiter {
  return createRateLimiter({
    store: { hit: () => Promise.reject(new Error('store is down')) },
    keySecret: TEST_SECRET,
    clock: systemClock,
    timeoutMs: TEST_TIMEOUT_MS,
    log: SILENT_LOG,
  });
}
