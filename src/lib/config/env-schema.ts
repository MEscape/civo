import { z } from 'zod';

import { authEnvSchema } from './auth-env-schema';

const DEFAULT_NODE_ENV = 'development' as const;
const DEFAULT_DATABASE_POOL_SIZE = 10;
const DEFAULT_DATABASE_POOL_TIMEOUT_SECONDS = 10;
const DEFAULT_LOG_LEVEL = 'info' as const;
const DEFAULT_PUBLIC_APP_URL = 'http://localhost:3000';
const DEFAULT_MAPBOX_STYLE_URL = 'mapbox://styles/mapbox/light-v11';

/** Only Mapbox-hosted styles: the map must not load a style from an arbitrary address. */
const MAPBOX_STYLE_URL_PATTERN = /^mapbox:\/\/styles\/[\w-]+\/[\w-]+$/;

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
 * Authentication configuration is composed into the server schema so the
 * application has one validated server configuration object.
 */
export const serverEnvSchema = serverEnvBaseSchema.and(authEnvSchema).superRefine((env, ctx) => {
  if (!env.AUTH_ENABLED && env.NODE_ENV === 'production') {
    ctx.addIssue({
      code: 'custom',
      path: ['AUTH_ENABLED'],
      message: 'AUTH_ENABLED=false is not allowed when NODE_ENV=production.',
    });
  }

  if (env.AUTH_ENABLED && env.NODE_ENV === 'production' && env.AUTH_MAIL_PROVIDER === 'none') {
    ctx.addIssue({
      code: 'custom',
      path: ['AUTH_MAIL_PROVIDER'],
      message: 'AUTH_MAIL_PROVIDER cannot be "none" in production when auth is enabled.',
    });
  }
});

/**
 * Public configuration.
 *
 * Only values explicitly intended for the client belong here.
 */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default(DEFAULT_PUBLIC_APP_URL),

  /**
   * A Mapbox PUBLIC token (`pk.…`), which Mapbox designs to be shipped to the
   * browser and which should be URL-restricted in the Mapbox account. Never
   * put a secret token (`sk.…`) here. Without it the map still works as a
   * list, only the map background is unavailable.
   */
  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: z
    .string()
    .regex(/^pk\./, 'Must be a Mapbox public token (pk.…).')
    .optional(),

  NEXT_PUBLIC_MAPBOX_STYLE_URL: z
    .string()
    .regex(MAPBOX_STYLE_URL_PATTERN, 'Must look like mapbox://styles/<owner>/<style>.')
    .default(DEFAULT_MAPBOX_STYLE_URL),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;
