// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import { systemClock } from '@lib/clock';
import { createRateLimiter } from '@lib/rate-limit/create-rate-limiter';
import type { RateLimitPolicy } from '@lib/rate-limit/rate-limit-policy';
import type { RateLimiter } from '@lib/rate-limit/rate-limiter';
import { UpstashRateLimitStore } from '@lib/rate-limit/upstash-rate-limit-store';

import { createFakeLog, SECRET } from './support';

/**
 * The Upstash store and the application's wiring against a real REST endpoint: Upstash itself, or
 * `hiett/serverless-redis-http` in front of a Redis (what CI and `npm run infra:up` run), which speaks
 * the same protocol. Skipped unless `RATE_LIMIT_TEST_REST_URL` and `RATE_LIMIT_TEST_REST_TOKEN` are set.
 */
const REST_URL = process.env['RATE_LIMIT_TEST_REST_URL'];
const REST_TOKEN = process.env['RATE_LIMIT_TEST_REST_TOKEN'];
const TIMEOUT_MS = 3000;
const CONCURRENT_HITS = 50;
const SHORT_WINDOW_SECONDS = 1;
const MILLISECONDS_PER_SECOND = 1000;

const POLICY: RateLimitPolicy = {
  id: 'integration.operation',
  limit: 2,
  windowSeconds: 60,
  onBackendFailure: 'deny',
};

/** Every run uses keys no earlier run (or parallel file) has touched. */
function uniqueKey(label: string): string {
  return `integration:${label}:${crypto.randomUUID()}`;
}

/** The wiring caches its limiter on `globalThis` (hot-reload safety) and reads the environment once per import. */
async function limiterBuiltFromEnvironment(token: string): Promise<RateLimiter> {
  vi.stubEnv('RATE_LIMIT_BACKEND', 'upstash');
  vi.stubEnv('RATE_LIMIT_SECRET', SECRET);
  vi.stubEnv('UPSTASH_REDIS_REST_URL', REST_URL ?? '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', token);
  vi.resetModules();
  delete (globalThis as { rateLimiter?: unknown }).rateLimiter;
  const { getRateLimiter } = await import('@lib/rate-limit/default-rate-limiter');
  return getRateLimiter();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe.skipIf(REST_URL === undefined || REST_TOKEN === undefined)(
  'UpstashRateLimitStore against a real REST endpoint',
  () => {
    const store = new UpstashRateLimitStore({
      restUrl: REST_URL ?? '',
      restToken: REST_TOKEN ?? '',
      timeoutMs: TIMEOUT_MS,
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it('counts hits in a window and reports what is left of it', async () => {
      const key = uniqueKey('count');

      const first = await store.hit(key, 60);
      const second = await store.hit(key, 60);

      expect(first.hits).toBe(1);
      expect(second.hits).toBe(2);
      expect(second.retryAfterSeconds).toBeGreaterThan(0);
      expect(second.retryAfterSeconds).toBeLessThanOrEqual(60);
    });

    it('does not extend the window with further hits', async () => {
      const key = uniqueKey('fixed-window');

      const first = await store.hit(key, 60);
      await sleep(MILLISECONDS_PER_SECOND);
      const later = await store.hit(key, 60);

      expect(later.retryAfterSeconds).toBeLessThan(first.retryAfterSeconds);
    });

    it('restarts the counter when the window has ended, with nothing to clean up', async () => {
      const key = uniqueKey('restart');
      await store.hit(key, SHORT_WINDOW_SECONDS);
      await store.hit(key, SHORT_WINDOW_SECONDS);

      await sleep(SHORT_WINDOW_SECONDS * MILLISECONDS_PER_SECOND + 300);

      expect((await store.hit(key, SHORT_WINDOW_SECONDS)).hits).toBe(1);
    });

    it('counts concurrent hits exactly once each', async () => {
      const key = uniqueKey('concurrent');

      const hits = await Promise.all(
        Array.from({ length: CONCURRENT_HITS }, () => store.hit(key, 60)),
      );

      expect(hits.map((hit) => hit.hits).sort((a, b) => a - b)).toEqual(
        Array.from({ length: CONCURRENT_HITS }, (_, index) => index + 1),
      );
    });

    it('rejects with a wrong token rather than answering from somewhere else', async () => {
      const unauthorized = new UpstashRateLimitStore({
        restUrl: REST_URL ?? '',
        restToken: 'not-the-token',
        timeoutMs: TIMEOUT_MS,
      });

      await expect(unauthorized.hit(uniqueKey('token'), 60)).rejects.toThrow('HTTP 401');
    });

    it('limits end to end through the limiter', async () => {
      const limiter = createRateLimiter({
        store,
        keySecret: SECRET,
        clock: systemClock,
        timeoutMs: TIMEOUT_MS,
        log: createFakeLog(),
      });
      const subject = { kind: 'identifier', value: `${crypto.randomUUID()}@example.org` } as const;

      const results = [];
      for (let attempt = 0; attempt < 3; attempt += 1) {
        results.push(await limiter.enforce({ policy: POLICY, subject }));
      }

      expect(results.map((result) => result.isOk())).toEqual([true, true, false]);
      expect(results[2]?.isErr() && results[2].error.kind).toBe('rate_limited');
    });

    it('is what getRateLimiter builds from the environment, and it denies when the store is down', async () => {
      const subject = { kind: 'identifier', value: `${crypto.randomUUID()}@example.org` } as const;

      const working = await (
        await limiterBuiltFromEnvironment(REST_TOKEN ?? '')
      ).enforce({
        policy: POLICY,
        subject,
      });
      const down = await (
        await limiterBuiltFromEnvironment('not-the-token')
      ).enforce({
        policy: POLICY,
        subject,
      });

      expect(working.isOk()).toBe(true);
      expect(down.isErr() && down.error.kind).toBe('infrastructure');
    });
  },
);
