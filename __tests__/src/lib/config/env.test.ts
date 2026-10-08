import { describe, expect, it } from 'vitest';

import { publicEnvSchema, serverEnvSchema } from '@lib/config/env-schema';

/** Authentication is on by default and then needs its own settings; these tests are about the rest. */
const AUTH_DISABLED = { AUTH_ENABLED: 'false' } as const;

describe('serverEnvSchema', () => {
  it('applies expected defaults when optional fields are omitted', () => {
    const result = serverEnvSchema.safeParse({
      ...AUTH_DISABLED,
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
        NODE_ENV: 'development',
        DATABASE_POOL_SIZE: 10,
        DATABASE_POOL_TIMEOUT_SECONDS: 10,
        LOG_LEVEL: 'info',
        AUTH_ENABLED: false,
        AUTH_MAIL_PROVIDER: 'none',
        AUTH_MAIL_SMTP_SECURE: false,
      });
    }
  });

  it('requires the auth secret and database when auth is enabled (the default)', () => {
    const result = serverEnvSchema.safeParse({
      DATABASE_URL: 'postgres://localhost/db',
    });
    expect(result.success).toBe(false);
  });

  it.each([
    ['true', true],
    ['false', false],
  ])('reads the flag AUTH_MAIL_SMTP_SECURE=%s as %s', (raw, expected) => {
    const result = serverEnvSchema.safeParse({
      ...AUTH_DISABLED,
      DATABASE_URL: 'postgres://localhost/db',
      AUTH_MAIL_SMTP_SECURE: raw,
    });
    expect(result.success && result.data.AUTH_MAIL_SMTP_SECURE).toBe(expected);
  });

  it('fails if the required DATABASE_URL is missing', () => {
    const result = serverEnvSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('fails if DATABASE_URL is not a valid URL', () => {
    const result = serverEnvSchema.safeParse({
      DATABASE_URL: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('coerces string values to integers for pool configurations', () => {
    const result = serverEnvSchema.safeParse({
      ...AUTH_DISABLED,
      DATABASE_URL: 'postgres://localhost/db',
      DATABASE_POOL_SIZE: '15',
      DATABASE_POOL_TIMEOUT_SECONDS: '5',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.DATABASE_POOL_SIZE).toBe(15);
      expect(result.data.DATABASE_POOL_TIMEOUT_SECONDS).toBe(5);
    }
  });

  it.each([
    ['0', 'zero'],
    ['-5', 'negative'],
    ['1.5', 'float'],
    ['abc', 'not a number'],
  ])('rejects invalid pool size: %s (%s)', (invalidSize) => {
    const result = serverEnvSchema.safeParse({
      DATABASE_URL: 'postgres://localhost/db',
      DATABASE_POOL_SIZE: invalidSize,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid NODE_ENV', () => {
    const result = serverEnvSchema.safeParse({
      DATABASE_URL: 'postgres://localhost/db',
      NODE_ENV: 'staging', // only dev, test, prod are allowed
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid LOG_LEVEL', () => {
    const result = serverEnvSchema.safeParse({
      DATABASE_URL: 'postgres://localhost/db',
      LOG_LEVEL: 'trace', // not in the enum
    });
    expect(result.success).toBe(false);
  });
});

describe('publicEnvSchema', () => {
  it('applies the default local URL when omitted', () => {
    const result = publicEnvSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
    }
  });

  it('accepts a valid application URL', () => {
    const result = publicEnvSchema.safeParse({
      NEXT_PUBLIC_APP_URL: 'https://production.example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NEXT_PUBLIC_APP_URL).toBe('https://production.example.com');
    }
  });

  it('rejects an invalid NEXT_PUBLIC_APP_URL', () => {
    const result = publicEnvSchema.safeParse({
      NEXT_PUBLIC_APP_URL: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });
});

describe('publicEnvSchema: map configuration', () => {
  it('works without a Mapbox token and defaults the style', () => {
    const result = publicEnvSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN).toBeUndefined();
      expect(result.data.NEXT_PUBLIC_MAPBOX_STYLE_URL).toBe('mapbox://styles/mapbox/light-v11');
    }
  });

  it('accepts a public token and refuses a secret one', () => {
    expect(publicEnvSchema.safeParse({ NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: 'pk.abc' }).success).toBe(
      true,
    );
    expect(publicEnvSchema.safeParse({ NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: 'sk.abc' }).success).toBe(
      false,
    );
  });

  it('only accepts Mapbox-hosted style URLs', () => {
    expect(
      publicEnvSchema.safeParse({ NEXT_PUBLIC_MAPBOX_STYLE_URL: 'mapbox://styles/acme/city-dark' })
        .success,
    ).toBe(true);
    expect(
      publicEnvSchema.safeParse({ NEXT_PUBLIC_MAPBOX_STYLE_URL: 'https://evil.example/style.json' })
        .success,
    ).toBe(false);
  });
});
