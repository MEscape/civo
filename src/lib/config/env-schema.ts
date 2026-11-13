import { z } from 'zod';

import { authEnvSchema } from './auth-env-schema';
import { httpUrl, integerSetting, postgresUrl } from './env-primitives';
import { refineEnv } from './env-rules';
import { mailEnvSchema } from './mail-env-schema';
import { nonEmpty, rateLimitEnvSchema } from './rate-limit-env-schema';
import { storageEnvSchema } from './storage-env-schema';

import type { AuthEnv } from './auth-env-schema';
import type { EnvRule } from './env-rules';
import type { MailEnv } from './mail-env-schema';
import type { RateLimitEnv } from './rate-limit-env-schema';
import type { StorageEnv } from './storage-env-schema';

const DEFAULT_NODE_ENV = 'development' as const;
const DEFAULT_DATABASE_POOL_SIZE = 10;
const DEFAULT_DATABASE_POOL_TIMEOUT_SECONDS = 10;
const DEFAULT_DATABASE_STATEMENT_TIMEOUT_SECONDS = 30;
const DEFAULT_LOG_LEVEL = 'info' as const;
/** A year of history; a deployment with a different retention duty sets its own. */
const DEFAULT_AUDIT_RETENTION_DAYS = 365;
const DEFAULT_BOOKING_RETENTION_DAYS = 365;
/** What both retentions may be set to: a month at least, ten years at most. */
const MIN_RETENTION_DAYS = 30;
const MAX_RETENTION_DAYS = 3650;

const serverEnvBaseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default(DEFAULT_NODE_ENV),

  DATABASE_URL: postgresUrl,

  DATABASE_POOL_SIZE: integerSetting(DEFAULT_DATABASE_POOL_SIZE),

  DATABASE_POOL_TIMEOUT_SECONDS: integerSetting(DEFAULT_DATABASE_POOL_TIMEOUT_SECONDS),

  /** The database aborts any one statement that runs longer, so a runaway query cannot hold a pooled connection. */
  DATABASE_STATEMENT_TIMEOUT_SECONDS: integerSetting(DEFAULT_DATABASE_STATEMENT_TIMEOUT_SECONDS),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default(DEFAULT_LOG_LEVEL),
  /** Optional local reference-city credential. The development seed generates an ignored local file when absent. */
  WUERZBURG_DEMO_PASSWORD: z.string().min(16).optional(),

  AUDIT_RETENTION_DAYS: integerSetting(DEFAULT_AUDIT_RETENTION_DAYS, {
    min: MIN_RETENTION_DAYS,
    max: MAX_RETENTION_DAYS,
  }),

  /** Days after an appointment ended that its booking, with the citizen's name and e-mail, is kept. */
  BOOKING_RETENTION_DAYS: integerSetting(DEFAULT_BOOKING_RETENTION_DAYS, {
    min: MIN_RETENTION_DAYS,
    max: MAX_RETENTION_DAYS,
  }),
});

/** Everything the server schema validates, as one value: what the rules below read. */
type ServerEnvShape = z.infer<typeof serverEnvBaseSchema> &
  AuthEnv &
  MailEnv &
  RateLimitEnv &
  StorageEnv;

const isProduction = (env: ServerEnvShape) => env.NODE_ENV === 'production';

/** What production demands of the domains together; a domain's own requirements stay in its file. */
const productionRules: ReadonlyArray<EnvRule<ServerEnvShape>> = [
  {
    path: 'AUTH_ENABLED',
    violated: (env) => isProduction(env) && !env.AUTH_ENABLED,
    message: 'AUTH_ENABLED=false is not allowed when NODE_ENV=production.',
  },
  {
    path: 'RATE_LIMIT_ENABLED',
    violated: (env) => isProduction(env) && !env.RATE_LIMIT_ENABLED,
    message: 'RATE_LIMIT_ENABLED=false is not allowed when NODE_ENV=production.',
  },
  {
    path: 'MAIL_PROVIDER',
    violated: (env) => isProduction(env) && env.MAIL_PROVIDER === 'none',
    message:
      'MAIL_PROVIDER must be "smtp" or "resend" in production: the application sends e-mail.',
  },
  {
    path: 'MAIL_PROVIDER',
    violated: (env) => !isProduction(env) && env.MAIL_PROVIDER === 'resend',
    message: 'MAIL_PROVIDER must be "none" or "smtp" outside production.',
  },
  {
    path: 'MAIL_API_URL',
    // Every request carries MAIL_API_KEY as a bearer credential.
    violated: (env) =>
      isProduction(env) &&
      env.MAIL_PROVIDER === 'resend' &&
      new URL(env.MAIL_API_URL).protocol !== 'https:',
    message: 'MAIL_API_URL must be an https URL in production.',
  },
  {
    path: 'UPSTASH_REDIS_REST_URL',
    // Every request carries UPSTASH_REDIS_REST_TOKEN as a bearer credential. The guards only keep
    // this rule quiet where the rate-limit rules already report a missing or malformed URL.
    violated: (env) => {
      const url = nonEmpty(env.UPSTASH_REDIS_REST_URL);
      return (
        isProduction(env) &&
        env.RATE_LIMIT_ENABLED &&
        url !== undefined &&
        httpUrl.safeParse(url).success &&
        new URL(url).protocol !== 'https:'
      );
    },
    message: 'UPSTASH_REDIS_REST_URL must be an https URL in production.',
  },
  {
    path: 'STORAGE_S3_ENDPOINT',
    // Signed upload and read URLs are bearer credentials: they must not travel over plain HTTP.
    violated: (env) => isProduction(env) && new URL(env.STORAGE_S3_ENDPOINT).protocol !== 'https:',
    message: 'STORAGE_S3_ENDPOINT must be an https URL in production.',
  },
  {
    path: 'STORAGE_PUBLIC_BASE_URL',
    // Unset only with a private bucket alone, when nothing is served publicly.
    violated: (env) =>
      isProduction(env) &&
      env.STORAGE_PUBLIC_BASE_URL !== undefined &&
      new URL(env.STORAGE_PUBLIC_BASE_URL).protocol !== 'https:',
    message: 'STORAGE_PUBLIC_BASE_URL must be an https URL in production.',
  },
];

/**
 * Server-only configuration.
 *
 * Authentication, mail, rate-limit and storage configuration are composed into the
 * server schema so the application has one validated server configuration
 * object. Rules internal to one domain live in that domain's file and are attached there with its
 * own `superRefine`; what production demands of them, which needs `NODE_ENV`, is
 * `productionRules`.
 */
export const serverEnvSchema = serverEnvBaseSchema
  .and(authEnvSchema)
  .and(mailEnvSchema)
  .and(rateLimitEnvSchema)
  .and(storageEnvSchema)
  .superRefine(refineEnv<ServerEnvShape>(productionRules));

/** Everything the server reads from the environment, secrets included. */
export type ServerEnv = z.infer<typeof serverEnvSchema>;
