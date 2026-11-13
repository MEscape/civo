import { describe, expect, it } from 'vitest';

import { serverEnvSchema } from '@lib/config/env-schema';
import { storageEnvSchema } from '@lib/config/storage-env-schema';

/** The smallest working setup: a compatible service with one public bucket. */
const R2 = {
  STORAGE_S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
  STORAGE_S3_ACCESS_KEY_ID: 'id',
  STORAGE_S3_SECRET_ACCESS_KEY: 'secret',
  STORAGE_S3_PUBLIC_BUCKET: 'civo-public',
  STORAGE_PUBLIC_BASE_URL: 'https://media.example.org',
} as const;

type Source = Record<string, string>;

function problems(source: Source): Array<[string, string]> {
  const result = storageEnvSchema.safeParse(source);
  return result.success
    ? []
    : result.error.issues.map((issue) => [issue.path.join('.'), issue.message]);
}
const paths = (source: Source) => problems(source).map(([path]) => path);

/** `R2` without the named variables. */
function without(...names: Array<keyof typeof R2>): Source {
  return Object.fromEntries(Object.entries(R2).filter(([name]) => !names.some((n) => n === name)));
}

describe('storageEnvSchema', () => {
  it('cannot be switched off: with nothing set, every required variable is named', () => {
    expect(paths({})).toEqual([
      'STORAGE_S3_ENDPOINT',
      'STORAGE_S3_ACCESS_KEY_ID',
      'STORAGE_S3_SECRET_ACCESS_KEY',
    ]);
  });

  it('accepts a compatible service with a public bucket', () => {
    expect(problems(R2)).toEqual([]);
  });

  it('accepts a service that names its region, with a private bucket alone', () => {
    expect(
      problems({
        STORAGE_S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
        STORAGE_S3_REGION: 'eu-central-1',
        STORAGE_S3_ACCESS_KEY_ID: 'id',
        STORAGE_S3_SECRET_ACCESS_KEY: 'secret',
        STORAGE_S3_PRIVATE_BUCKET: 'civo-private',
      }),
    ).toEqual([]);
  });

  it.each([
    ['STORAGE_S3_ENDPOINT', 'ftp://files.example.org'],
    ['STORAGE_S3_ENDPOINT', 'javascript:alert(1)'],
    ['STORAGE_PUBLIC_BASE_URL', 'file:///etc/passwd'],
    ['STORAGE_S3_PUBLIC_BUCKET', 'UPPER_case'],
    ['STORAGE_S3_PRIVATE_BUCKET', 'ab'],
  ])('rejects %s=%s', (name, value) => {
    expect(paths({ ...R2, [name]: value })).toContain(name);
  });

  describe('the rules between the variables', () => {
    it.each(['STORAGE_S3_ACCESS_KEY_ID', 'STORAGE_S3_SECRET_ACCESS_KEY'] as const)(
      'requires %s',
      (name) => {
        expect(paths(without(name))).toEqual([name]);
      },
    );

    it('requires the endpoint, and leaves the region optional', () => {
      expect(paths(without('STORAGE_S3_ENDPOINT'))).toEqual(['STORAGE_S3_ENDPOINT']);
      expect(problems({ ...R2, STORAGE_S3_REGION: 'us-east-2' })).toEqual([]);
    });

    it('requires at least one bucket', () => {
      expect(paths(without('STORAGE_S3_PUBLIC_BUCKET', 'STORAGE_PUBLIC_BASE_URL'))).toEqual([
        'STORAGE_S3_PUBLIC_BUCKET',
      ]);
    });

    it('keeps the private bucket apart from the public one', () => {
      expect(paths({ ...R2, STORAGE_S3_PRIVATE_BUCKET: 'civo-public' })).toEqual([
        'STORAGE_S3_PRIVATE_BUCKET',
      ]);
      expect(problems({ ...R2, STORAGE_S3_PRIVATE_BUCKET: 'civo-private' })).toEqual([]);
    });

    it('needs a public origin for a public bucket, and a public bucket for a public origin', () => {
      expect(paths(without('STORAGE_PUBLIC_BASE_URL'))).toEqual(['STORAGE_PUBLIC_BASE_URL']);
      expect(
        paths({
          ...without('STORAGE_S3_PUBLIC_BUCKET'),
          STORAGE_S3_PRIVATE_BUCKET: 'civo-private',
        }),
      ).toEqual(['STORAGE_PUBLIC_BASE_URL']);
    });

    it.each([
      'https://user:pass@media.example.org',
      'https://media.example.org?token=1',
      'https://media.example.org#frag',
    ])('keeps credentials, queries and fragments out of the public origin: %s', (url) => {
      expect(paths({ ...R2, STORAGE_PUBLIC_BASE_URL: url })).toEqual(['STORAGE_PUBLIC_BASE_URL']);
    });

    it('lets the public origin carry a path, as for a bucket served below its endpoint', () => {
      expect(
        problems({ ...R2, STORAGE_PUBLIC_BASE_URL: 'http://localhost:9000/civo-public' }),
      ).toEqual([]);
    });

    it.each(['STORAGE_S3_PUBLIC_BUCKET', 'STORAGE_S3_PRIVATE_BUCKET'])(
      'accepts a dotted %s, since buckets are always addressed by path',
      (name) => {
        expect(problems({ ...R2, [name]: 'media.example' })).toEqual([]);
      },
    );
  });
});

describe('serverEnvSchema: storage in production', () => {
  const PRODUCTION = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://localhost/db',
    AUTH_SECRET: 'x'.repeat(48),
    AUTH_DATABASE_URL: 'postgres://localhost/auth',
    MAIL_PROVIDER: 'smtp',
    MAIL_SMTP_HOST: 'mail.example.org',
    MAIL_FROM: 'noreply@example.org',
    RATE_LIMIT_CLIENT_ADDRESS_SOURCE: 'vercel',
    UPSTASH_REDIS_REST_URL: 'https://redis.example.org',
    UPSTASH_REDIS_REST_TOKEN: 'token',
  };
  const issuePaths = (source: Source) => {
    const result = serverEnvSchema.safeParse({ ...PRODUCTION, ...source });
    return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
  };

  it('accepts https storage', () => {
    expect(issuePaths(R2)).toEqual([]);
  });

  it('refuses a signing endpoint or a public origin over plain http', () => {
    expect(issuePaths({ ...R2, STORAGE_S3_ENDPOINT: 'http://acct.r2.example.org' })).toEqual([
      'STORAGE_S3_ENDPOINT',
    ]);
    expect(issuePaths({ ...R2, STORAGE_PUBLIC_BASE_URL: 'http://media.example.org' })).toEqual([
      'STORAGE_PUBLIC_BASE_URL',
    ]);
  });

  it('allows plain http outside production, for a local RustFS', () => {
    const result = serverEnvSchema.safeParse({
      DATABASE_URL: 'postgres://localhost/db',
      AUTH_ENABLED: 'false',
      RATE_LIMIT_ENABLED: 'false',
      ...R2,
      STORAGE_S3_ENDPOINT: 'http://localhost:9000',
      STORAGE_PUBLIC_BASE_URL: 'http://localhost:9000/civo-public',
    });

    expect(result.success).toBe(true);
  });
});
