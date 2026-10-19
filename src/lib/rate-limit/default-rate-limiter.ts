import 'server-only';

import { randomBytes } from 'node:crypto';

import { systemClock } from '@lib/clock';
import { resolveRateLimitSettings, serverEnv } from '@lib/config/server';
import { infrastructureError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { createRateLimiter } from './create-rate-limiter';
import { InMemoryRateLimitStore } from './in-memory-rate-limit-store';
import { createRateLimitLog } from './rate-limit-logger';
import { UpstashRateLimitStore } from './upstash-rate-limit-store';

import type { RateLimitStore } from './rate-limit-store';
import type { RateLimitFailure, RateLimiter } from './rate-limiter';

const MEMORY_SECRET_BYTES = 32;

const globalForRateLimit = globalThis as unknown as {
  rateLimiter: RateLimiter | undefined;
}; // globalThis has no declared shape; this is the standard hot-reload singleton pattern.

function buildLimiter(): RateLimiter {
  const settings = resolveRateLimitSettings(serverEnv);

  const store: RateLimitStore =
    settings.backend === 'upstash'
      ? new UpstashRateLimitStore({
          restUrl: settings.restUrl,
          restToken: settings.restToken,
          timeoutMs: settings.timeoutMs,
        })
      : new InMemoryRateLimitStore(systemClock);

  return createRateLimiter({
    store,
    // The memory backend is per process, so a per-process key is as good as a configured one.
    keySecret: settings.keySecret ?? randomBytes(MEMORY_SECRET_BYTES).toString('hex'),
    clock: systemClock,
    timeoutMs: settings.timeoutMs,
    log: createRateLimitLog(),
  });
}

function limiter(): RateLimiter {
  globalForRateLimit.rateLimiter ??= buildLimiter();
  return globalForRateLimit.rateLimiter;
}

/**
 * The application's rate limiter. Only `composition.ts` files call this and hand the result to use
 * cases as a `RateLimiter`.
 *
 * Nothing is built until the first `enforce`: importing a composition root (during `next build`, or
 * at module load) reads no configuration and opens no connection. If building the real limiter then
 * fails, the attempt is refused with an infrastructure error, which is what every policy that denies
 * on failure wants, and `enforce` still never throws. It never falls back to another backend: if the
 * configured store is down, each policy's `onBackendFailure` decides.
 */
export function getRateLimiter(): RateLimiter {
  function guarded<T>(
    run: (built: RateLimiter) => AppResultAsync<T, RateLimitFailure>,
  ): AppResultAsync<T, RateLimitFailure> {
    try {
      return run(limiter());
    } catch (thrown) {
      createRateLimitLog().error('rate_limit.unavailable', thrown, { reason: 'build_failed' });
      return errAsync(
        infrastructureError('rate_limit.unavailable', 'Rate limiting is unavailable.', thrown),
      );
    }
  }

  return {
    enforce: (request) => guarded((built) => built.enforce(request)),
    enforceAll: (requests) => guarded((built) => built.enforceAll(requests)),
  };
}
