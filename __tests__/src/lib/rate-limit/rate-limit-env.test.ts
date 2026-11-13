import { describe, expect, it } from 'vitest';

import { envRuleIssues } from '@lib/config/env-rules';
import { serverEnvSchema } from '@lib/config/env-schema';
import { rateLimitEnvRules, rateLimitEnvSchema } from '@lib/config/rate-limit-env-schema';
import type { RateLimitEnv } from '@lib/config/rate-limit-env-schema';
import { resolveRateLimitSettings } from '@lib/config/rate-limit-settings';

const LONG_SECRET = 's'.repeat(40);

const rateLimitConfigIssues = (env: RateLimitEnv) => envRuleIssues(env, rateLimitEnvRules);

/** A complete, enabled configuration; each test overrides what it is about. */
function input(overrides: Partial<RateLimitEnv> = {}): RateLimitEnv {
  return {
    // The defaults of every other variable; the flag is switched off only to get past the rules.
    ...rateLimitEnvSchema.parse({ RATE_LIMIT_ENABLED: 'false' }),
    RATE_LIMIT_ENABLED: true,
    RATE_LIMIT_CLIENT_ADDRESS_SOURCE: 'vercel',
    UPSTASH_REDIS_REST_URL: 'http://localhost:8079',
    UPSTASH_REDIS_REST_TOKEN: 'token',
    AUTH_SECRET: LONG_SECRET,
    ...overrides,
  };
}

describe('rate-limit configuration', () => {
  it('is enabled by default and needs the shared store', () => {
    expect(input().RATE_LIMIT_ENABLED).toBe(true);

    const issues = rateLimitConfigIssues(
      input({ UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined }),
    );

    expect(issues.map((issue) => issue.path)).toEqual([
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN',
    ]);
  });

  it('reads the flag as exactly true or false', () => {
    expect(rateLimitEnvSchema.parse({ RATE_LIMIT_ENABLED: 'false' }).RATE_LIMIT_ENABLED).toBe(
      false,
    );
    expect(rateLimitEnvSchema.safeParse({ RATE_LIMIT_ENABLED: 'no' }).success).toBe(false);
  });

  it('turns the limiter off without needing the store or any other setting', () => {
    const env = input({
      RATE_LIMIT_ENABLED: false,
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
      AUTH_SECRET: undefined,
      RATE_LIMIT_CLIENT_ADDRESS_SOURCE: 'proxies',
    });

    expect(rateLimitConfigIssues(env)).toEqual([]);
    expect(resolveRateLimitSettings(env)).toEqual({ enabled: false });
  });

  it('resolves the store settings and falls back to the auth secret', () => {
    const settings = resolveRateLimitSettings(
      input({ UPSTASH_REDIS_REST_URL: 'https://eu1-example.upstash.io' }),
    );

    expect(settings).toEqual({
      enabled: true,
      restUrl: 'https://eu1-example.upstash.io',
      restToken: 'token',
      keySecret: LONG_SECRET,
      timeoutMs: 1500,
      clientAddress: { source: 'vercel', trustedProxies: [] },
    });
  });

  it('prefers its own secret over the fallback', () => {
    const settings = resolveRateLimitSettings(input({ RATE_LIMIT_SECRET: 'r'.repeat(32) }));

    expect(settings).toMatchObject({ keySecret: 'r'.repeat(32) });
  });

  it('requires the Upstash endpoint, its token and a long enough secret', () => {
    const issues = rateLimitConfigIssues(
      input({
        UPSTASH_REDIS_REST_URL: undefined,
        UPSTASH_REDIS_REST_TOKEN: undefined,
        AUTH_SECRET: 'too short',
      }),
    );

    expect(issues.map((issue) => issue.path)).toEqual([
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN',
      'RATE_LIMIT_SECRET',
    ]);
  });

  it('refuses an Upstash endpoint that is not an http(s) URL', () => {
    const issues = rateLimitConfigIssues(
      input({ UPSTASH_REDIS_REST_URL: 'redis://localhost:6379' }),
    );

    expect(issues.map((issue) => issue.path)).toEqual(['UPSTASH_REDIS_REST_URL']);
  });

  it('treats an empty value as unset', () => {
    const issues = rateLimitConfigIssues(
      input({
        UPSTASH_REDIS_REST_URL: '',
        UPSTASH_REDIS_REST_TOKEN: '',
        RATE_LIMIT_SECRET: '',
      }),
    );

    expect(issues.map((issue) => issue.path)).toEqual([
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN',
    ]);
  });

  it.each([
    { RATE_LIMIT_TIMEOUT_MS: '50' },
    { RATE_LIMIT_TIMEOUT_MS: '60000' },
    { RATE_LIMIT_ENABLED: 'maybe' },
  ])('rejects the out-of-range or unknown setting %j', (bad) => {
    expect(rateLimitEnvSchema.safeParse(bad).success).toBe(false);
  });

  describe('client address source', () => {
    it('has no default: while the limiter is on, the operator names who tells the address', () => {
      const issues = rateLimitConfigIssues(input({ RATE_LIMIT_CLIENT_ADDRESS_SOURCE: undefined }));

      expect(issues).toEqual([
        expect.objectContaining({
          path: 'RATE_LIMIT_CLIENT_ADDRESS_SOURCE',
          message: expect.stringContaining('vercel, cloudflare, azure, proxies'),
        }),
      ]);
      expect(() =>
        resolveRateLimitSettings(input({ RATE_LIMIT_CLIENT_ADDRESS_SOURCE: undefined })),
      ).toThrow(/client address source missing/);
    });

    it.each(['none', 'oracle', ''])('does not know the source %j', (value) => {
      expect(
        rateLimitEnvSchema.safeParse({ RATE_LIMIT_CLIENT_ADDRESS_SOURCE: value }).success,
      ).toBe(false);
    });

    it.each(['vercel', 'cloudflare', 'azure'] as const)(
      'accepts %s and ignores a proxy list it does not use',
      (source) => {
        const settings = resolveRateLimitSettings(
          input({ RATE_LIMIT_CLIENT_ADDRESS_SOURCE: source, AUTH_TRUSTED_PROXIES: ['10.0.0.1'] }),
        );

        expect(settings).toMatchObject({ clientAddress: { source, trustedProxies: [] } });
      },
    );

    it('keeps the trusted proxy list for the proxies source', () => {
      const settings = resolveRateLimitSettings(
        input({
          RATE_LIMIT_CLIENT_ADDRESS_SOURCE: 'proxies',
          AUTH_TRUSTED_PROXIES: ['10.0.0.0/8', '2001:db8::1'],
        }),
      );

      expect(settings).toMatchObject({
        clientAddress: { source: 'proxies', trustedProxies: ['10.0.0.0/8', '2001:db8::1'] },
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
        const issues = rateLimitConfigIssues(
          input({
            RATE_LIMIT_CLIENT_ADDRESS_SOURCE: 'proxies',
            AUTH_TRUSTED_PROXIES: ['10.0.0.1', entry],
          }),
        );

        expect(issues).toHaveLength(1);
        expect(issues[0]?.message).toContain(entry);
      },
    );

    it.each(['10.0.0.1', '10.0.0.0/8', '2001:db8::/32', '::1', '::ffff:10.0.0.1'])(
      'accepts the trusted proxy %j',
      (entry) => {
        expect(
          rateLimitConfigIssues(
            input({ RATE_LIMIT_CLIENT_ADDRESS_SOURCE: 'proxies', AUTH_TRUSTED_PROXIES: [entry] }),
          ),
        ).toEqual([]);
      },
    );
  });

  describe('as part of the server schema', () => {
    const base = {
      AUTH_ENABLED: 'false',
      DATABASE_URL: 'postgres://localhost/db',
      STORAGE_S3_ENDPOINT: 'https://s3.example.org',
      STORAGE_S3_ACCESS_KEY_ID: 'id',
      STORAGE_S3_SECRET_ACCESS_KEY: 'secret',
      STORAGE_S3_PRIVATE_BUCKET: 'civo-private',
    };

    it('stops the application at startup when the enabled limiter has no store', () => {
      const broken = serverEnvSchema.safeParse(base);

      expect(broken.success).toBe(false);
      expect(!broken.success && broken.error.issues.map((issue) => issue.path[0])).toContain(
        'UPSTASH_REDIS_REST_URL',
      );
    });

    it('reports the rules of the rate-limit schema on their own, without the server schema', () => {
      const alone = rateLimitEnvSchema.safeParse({});

      expect(!alone.success && alone.error.issues.map((issue) => issue.path[0])).toContain(
        'UPSTASH_REDIS_REST_URL',
      );
    });

    it('refuses a plain-http Upstash endpoint in production only', () => {
      const withUrl = {
        ...base,
        RATE_LIMIT_CLIENT_ADDRESS_SOURCE: 'vercel',
        UPSTASH_REDIS_REST_URL: 'http://localhost:8079',
        UPSTASH_REDIS_REST_TOKEN: 'token',
        RATE_LIMIT_SECRET: LONG_SECRET,
      };

      expect(serverEnvSchema.safeParse(withUrl).success).toBe(true);
      const production = serverEnvSchema.safeParse({ ...withUrl, NODE_ENV: 'production' });
      expect(
        !production.success && production.error.issues.map((issue) => issue.path[0]),
      ).toContain('UPSTASH_REDIS_REST_URL');
    });

    it('accepts a disabled limiter outside production', () => {
      expect(serverEnvSchema.safeParse({ ...base, RATE_LIMIT_ENABLED: 'false' }).success).toBe(
        true,
      );
    });

    it('refuses a disabled limiter in production', () => {
      const result = serverEnvSchema.safeParse({
        ...base,
        NODE_ENV: 'production',
        RATE_LIMIT_ENABLED: 'false',
      });

      expect(!result.success && result.error.issues.map((issue) => issue.path[0])).toContain(
        'RATE_LIMIT_ENABLED',
      );
    });
  });
});

describe('resolveRateLimitSettings', () => {
  it('refuses to build an enabled limiter from an environment the rules would have refused', () => {
    expect(() => resolveRateLimitSettings(input({ UPSTASH_REDIS_REST_URL: undefined }))).toThrow(
      /Upstash URL, token, secret or client address source missing/,
    );
  });
});
