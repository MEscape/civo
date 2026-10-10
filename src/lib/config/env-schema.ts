import { z } from 'zod';

import { authEnvSchema } from './auth-env-schema';
import { mailEnvSchema } from './mail-env-schema';

const DEFAULT_NODE_ENV = 'development' as const;
const DEFAULT_DATABASE_POOL_SIZE = 10;
const DEFAULT_DATABASE_POOL_TIMEOUT_SECONDS = 10;
const DEFAULT_LOG_LEVEL = 'info' as const;

const serverEnvBaseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default(DEFAULT_NODE_ENV),

  DATABASE_URL: z.url(),

  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(DEFAULT_DATABASE_POOL_SIZE),

  DATABASE_POOL_TIMEOUT_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_DATABASE_POOL_TIMEOUT_SECONDS),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default(DEFAULT_LOG_LEVEL),
});

/**
 * Server-only configuration.
 *
 * Authentication and mail configuration are composed into the server schema so
 * the application has one validated server configuration object.
 */
export const serverEnvSchema = serverEnvBaseSchema
  .and(authEnvSchema)
  .and(mailEnvSchema)
  .superRefine((env, ctx) => {
    if (!env.AUTH_ENABLED && env.NODE_ENV === 'production') {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_ENABLED'],
        message: 'AUTH_ENABLED=false is not allowed when NODE_ENV=production.',
      });
    }

    if (env.NODE_ENV === 'production' && env.MAIL_PROVIDER !== 'resend') {
      ctx.addIssue({
        code: 'custom',
        path: ['MAIL_PROVIDER'],
        message: 'MAIL_PROVIDER must be "resend" in production: sign-in and bookings send e-mail.',
      });
    }

    if (env.NODE_ENV !== 'production' && env.MAIL_PROVIDER === 'resend') {
      ctx.addIssue({
        code: 'custom',
        path: ['MAIL_PROVIDER'],
        message: 'MAIL_PROVIDER must be "none" or "smtp" outside production.',
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;
