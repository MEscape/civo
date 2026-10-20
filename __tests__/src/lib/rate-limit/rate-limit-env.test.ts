import { describe, expect, it } from 'vitest';

import { envRuleIssues } from '@lib/config/env-rules';
import { serverEnvSchema } from '@lib/config/env-schema';
import { rateLimitEnvRules, rateLimitEnvSchema } from '@lib/config/rate-limit-env-schema';
import type { RateLimitEnvInput } from '@lib/config/rate-limit-env-schema';
import { resolveRateLimitSettings } from '@lib/config/rate-limit-settings';

const LONG_SECRET = 's'.repeat(40);

const rateLimitConfigIssues = (env: RateLimitEnvInput) => envRuleIssues(env, rateLimitEnvRules);

function input(overrides: Partial<RateLimitEnvInput> = {}): RateLimitEnvInput {
  return { ...rateLimitEnvSchema.parse({}), NODE_ENV: 'development', ...overrides };
}

describe('rate-limit configuration', () => {
  it('needs nothing in development and uses the memory backend', () => {
    expect(rateLimitConfigIssues(input())).toEqual([]);
    expect(resolveRateLimitSettings(input())).toEqual({
      backend: 'memory',
      keySecret: undefined,
      timeoutMs: 1500,
      clientAddress: { source: 'none', configured: false, trustedProxies: [] },
    });
  });

  it('uses upstash in production and falls back to the auth secret', () => {
    const settings = resolveRateLimitSettings(
      input({
        NODE_ENV: 'production',
        UPSTASH_REDIS_REST_URL: 'https://eu1-example.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'token',
        AUTH_SECRET: LONG_SECRET,
      }),
    );

    expect(settings).toEqual({
      backend: 'upstash',
      restUrl: 'https://eu1-example.upstash.io',
      restToken: 'token',
      keySecret: LONG_SECRET,
      timeoutMs: 1500,
      clientAddress: { source: 'none', configured: false, trustedProxies: [] },
    });
  });

  it('prefers its own secret over the fallback', () => {
    const settings = resolveRateLimitSettings(
      input({
        NODE_ENV: 'production',
        UPSTASH_REDIS_REST_URL: 'https://eu1-example.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'token',
        AUTH_SECRET: LONG_SECRET,
        RATE_LIMIT_SECRET: 'r'.repeat(32),
      }),
    );

    expect(settings).toMatchObject({ keySecret: 'r'.repeat(32) });
  });

  it('refuses the memory backend in production, however it was chosen', () => {
    const issues = rateLimitConfigIssues(
      input({ NODE_ENV: 'production', RATE_LIMIT_BACKEND: 'memory' }),
    );

    expect(issues).toEqual([
      expect.objectContaining({
        path: 'RATE_LIMIT_BACKEND',
        message: expect.stringMatching(/memory backend/),
      }),
    ]);
  });

  it('requires the Upstash endpoint, its token and a long enough secret for the upstash backend', () => {
    const issues = rateLimitConfigIssues(
      input({ NODE_ENV: 'production', AUTH_SECRET: 'too short' }),
    );

    expect(issues.map((issue) => issue.path)).toEqual([
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN',
      'RATE_LIMIT_SECRET',
    ]);
  });

  it('refuses an Upstash endpoint that is not an http(s) URL', () => {
    const issues = rateLimitConfigIssues(
      input({
        NODE_ENV: 'production',
        UPSTASH_REDIS_REST_URL: 'redis://localhost:6379',
        UPSTASH_REDIS_REST_TOKEN: 'token',
        AUTH_SECRET: LONG_SECRET,
      }),
    );

    expect(issues.map((issue) => issue.path)).toEqual(['UPSTASH_REDIS_REST_URL']);
  });

  it('treats an empty value as unset', () => {
    const issues = rateLimitConfigIssues(
      input({
        NODE_ENV: 'production',
        UPSTASH_REDIS_REST_URL: '',
        UPSTASH_REDIS_REST_TOKEN: '',
        RATE_LIMIT_SECRET: '',
        AUTH_SECRET: LONG_SECRET,
      }),
    );

    expect(issues.map((issue) => issue.path)).toEqual([
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN',
    ]);
  });

  it('rejects a weak secret even for the memory backend when one is set', () => {
    const issues = rateLimitConfigIssues(input({ RATE_LIMIT_SECRET: 'short' }));

    expect(issues.map((issue) => issue.path)).toEqual(['RATE_LIMIT_SECRET']);
  });

  it.each([
    { RATE_LIMIT_TIMEOUT_MS: '50' },
    { RATE_LIMIT_TIMEOUT_MS: '60000' },
    { RATE_LIMIT_BACKEND: 'postgres' },
  ])('rejects the out-of-range or unknown setting %j', (bad) => {
    expect(rateLimitEnvSchema.safeParse(bad).success).toBe(false);
  });

  describe('client address source', () => {
    it('defaults to none, marked as not configured: nothing is trusted until the operator says what to trust', () => {
      expect(resolveRateLimitSettings(input()).clientAddress).toEqual({
        source: 'none',
        configured: false,
        trustedProxies: [],
      });
    });

    it('treats an explicit none as a decision, not an oversight', () => {
      expect(
        resolveRateLimitSettings(input({ RATE_LIMIT_CLIENT_ADDRESS_SOURCE: 'none' })).clientAddress,
      ).toEqual({ source: 'none', configured: true, trustedProxies: [] });
    });

    it('detects Vercel from its own system variable, so nothing needs to be remembered', () => {
      expect(resolveRateLimitSettings(input({ VERCEL: '1' })).clientAddress).toEqual({
        source: 'vercel',
        configured: true,
        trustedProxies: [],
      });
    });

    it('lets an explicit setting win over detection, in both directions', () => {
      expect(
        resolveRateLimitSettings(input({ VERCEL: '1', RATE_LIMIT_CLIENT_ADDRESS_SOURCE: 'none' }))
          .clientAddress.source,
      ).toBe('none');
      expect(
        resolveRateLimitSettings(
          input({
            VERCEL: '1',
            RATE_LIMIT_CLIENT_ADDRESS_SOURCE: 'proxies',
            AUTH_TRUSTED_PROXIES: ['10.0.0.1'],
          }),
        ).clientAddress.source,
      ).toBe('proxies');
    });

    it('ignores an empty VERCEL value', () => {
      expect(resolveRateLimitSettings(input({ VERCEL: '' })).clientAddress.source).toBe('none');
    });

    it('defaults to proxies when AUTH_TRUSTED_PROXIES is set, and keeps the list', () => {
      const settings = resolveRateLimitSettings(
        input({ AUTH_TRUSTED_PROXIES: ['10.0.0.0/8', '2001:db8::1'] }),
      );

      expect(settings.clientAddress).toEqual({
        source: 'proxies',
        configured: true,
        trustedProxies: ['10.0.0.0/8', '2001:db8::1'],
      });
    });

    it('accepts vercel explicitly and ignores a proxy list it does not use', () => {
      const settings = resolveRateLimitSettings(
        input({ RATE_LIMIT_CLIENT_ADDRESS_SOURCE: 'vercel', AUTH_TRUSTED_PROXIES: ['10.0.0.1'] }),
      );

      expect(settings.clientAddress).toEqual({
        source: 'vercel',
        configured: true,
        trustedProxies: [],
      });
    });

    it('refuses proxies without a trusted proxy list', () => {
      const issues = rateLimitConfigIssues(input({ RATE_LIMIT_CLIENT_ADDRESS_SOURCE: 'proxies' }));

      expect(issues).toEqual([
        expect.objectContaining({ path: 'RATE_LIMIT_CLIENT_ADDRESS_SOURCE' }),
      ]);
    });

    it.each(['not-an-ip', '10.0.0.0/33', '10.0.0.0/-1', '10.0.0.0/8/8', '::1/129', '10.0.0.0/'])(
      'refuses the malformed trusted proxy %j instead of letting it match nothing',
      (entry) => {
        const issues = rateLimitConfigIssues(input({ AUTH_TRUSTED_PROXIES: ['10.0.0.1', entry] }));

        expect(issues).toHaveLength(1);
        expect(issues[0]?.message).toContain(entry);
      },
    );

    it.each(['10.0.0.1', '10.0.0.0/8', '2001:db8::/32', '::1', '::ffff:10.0.0.1'])(
      'accepts the trusted proxy %j',
      (entry) => {
        expect(rateLimitConfigIssues(input({ AUTH_TRUSTED_PROXIES: [entry] }))).toEqual([]);
      },
    );
  });

  it('is part of the server schema, so a bad value stops the application at startup', () => {
    const base = { AUTH_ENABLED: 'false', DATABASE_URL: 'postgres://localhost/db' };

    expect(serverEnvSchema.safeParse(base).success).toBe(true);

    const broken = serverEnvSchema.safeParse({ ...base, RATE_LIMIT_BACKEND: 'upstash' });
    expect(broken.success).toBe(false);
    expect(!broken.success && broken.error.issues.map((issue) => issue.path[0])).toContain(
      'UPSTASH_REDIS_REST_URL',
    );
  });
});

describe('resolveRateLimitSettings', () => {
  it('refuses to build an upstash limiter from an environment the rules would have refused', () => {
    expect(() => resolveRateLimitSettings(input({ RATE_LIMIT_BACKEND: 'upstash' }))).toThrow(
      /Upstash URL, token or secret missing/,
    );
  });
});
