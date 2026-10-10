import { describe, expect, it } from 'vitest';

import { serverEnvSchema } from '@lib/config/env-schema';
import { publicEnvSchema } from '@lib/config/public-env-schema';

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
        MAIL_PROVIDER: 'none',
        MAIL_SMTP_SECURE: false,
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
  ])('reads the flag MAIL_SMTP_SECURE=%s as %s', (raw, expected) => {
    const result = serverEnvSchema.safeParse({
      ...AUTH_DISABLED,
      DATABASE_URL: 'postgres://localhost/db',
      MAIL_SMTP_SECURE: raw,
    });
    expect(result.success && result.data.MAIL_SMTP_SECURE).toBe(expected);
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

describe('serverEnvSchema: authentication modes', () => {
  const DATABASE = { DATABASE_URL: 'postgres://localhost/db' } as const;
  const AUTH_SECRETS = {
    AUTH_SECRET: 'x'.repeat(40),
    AUTH_DATABASE_URL: 'postgres://localhost/auth',
  } as const;
  const PRODUCTION_MAIL = {
    MAIL_PROVIDER: 'resend',
    MAIL_API_KEY: 're_key',
    MAIL_FROM: 'noreply@example.com',
  } as const;

  it('needs no authentication secrets in development with auth disabled', () => {
    expect(serverEnvSchema.safeParse({ ...DATABASE, ...AUTH_DISABLED }).success).toBe(true);
  });

  it('still requires the database when auth is disabled', () => {
    const result = serverEnvSchema.safeParse({ ...AUTH_DISABLED });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['DATABASE_URL']);
  });

  it('names exactly the authentication settings that are missing when auth is enabled', () => {
    const result = serverEnvSchema.safeParse({ ...DATABASE, AUTH_ENABLED: 'true' });
    expect(result.error?.issues.map((issue) => issue.path.join('.')).sort()).toEqual([
      'AUTH_DATABASE_URL',
      'AUTH_SECRET',
    ]);
  });

  it('accepts development with auth enabled and its secrets', () => {
    expect(serverEnvSchema.safeParse({ ...DATABASE, ...AUTH_SECRETS }).success).toBe(true);
  });

  it('refuses a production start with auth disabled', () => {
    const result = serverEnvSchema.safeParse({
      ...DATABASE,
      ...AUTH_DISABLED,
      ...PRODUCTION_MAIL,
      NODE_ENV: 'production',
    });
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['AUTH_ENABLED']);
  });

  it('refuses a production start without a mail provider', () => {
    const result = serverEnvSchema.safeParse({
      ...DATABASE,
      ...AUTH_SECRETS,
      NODE_ENV: 'production',
    });
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['MAIL_PROVIDER']);
  });

  it('accepts a fully configured production start', () => {
    const result = serverEnvSchema.safeParse({
      ...DATABASE,
      ...AUTH_SECRETS,
      ...PRODUCTION_MAIL,
      NODE_ENV: 'production',
    });
    expect(result.success).toBe(true);
  });
});

describe('serverEnvSchema: mail', () => {
  const BASE = { DATABASE_URL: 'postgres://localhost/db', AUTH_ENABLED: 'false' } as const;
  const paths = (input: Record<string, string>) =>
    serverEnvSchema
      .safeParse({ ...BASE, ...input })
      .error?.issues.map((issue) => issue.path.join('.'))
      .sort();

  it('sends nothing by default', () => {
    const result = serverEnvSchema.safeParse(BASE);
    expect(result.success && result.data.MAIL_PROVIDER).toBe('none');
  });

  it('needs a sender, and a host, for smtp', () => {
    expect(paths({ MAIL_PROVIDER: 'smtp' })).toEqual(['MAIL_FROM', 'MAIL_SMTP_HOST']);
    expect(
      serverEnvSchema.safeParse({
        ...BASE,
        MAIL_PROVIDER: 'smtp',
        MAIL_SMTP_HOST: 'localhost',
        MAIL_FROM: 'Civo <no-reply@example.org>',
      }).success,
    ).toBe(true);
  });

  it('refuses resend outside production, where mail would reach real people', () => {
    expect(
      paths({ MAIL_PROVIDER: 'resend', MAIL_API_KEY: 're_key', MAIL_FROM: 'a@example.org' }),
    ).toEqual(['MAIL_PROVIDER']);
  });

  it('needs the API key and sender for resend in production', () => {
    expect(
      paths({ NODE_ENV: 'production', AUTH_ENABLED: 'true', MAIL_PROVIDER: 'resend' }),
    ).toEqual(expect.arrayContaining(['MAIL_API_KEY', 'MAIL_FROM']));
  });

  it('requires mail to be configured in production, whatever else is on', () => {
    expect(
      paths({
        NODE_ENV: 'production',
        MAIL_PROVIDER: 'smtp',
        MAIL_SMTP_HOST: 'h',
        MAIL_FROM: 'a@b.c',
      }),
    ).toEqual(expect.arrayContaining(['MAIL_PROVIDER']));
  });
});
