import { z } from 'zod';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_DAY = 24 * 60 * SECONDS_PER_MINUTE;

const DEFAULT_AUTH_ENABLED = true;
const DEFAULT_AUTH_DATABASE_POOL_SIZE = 5;

const DEFAULT_SESSION_EXPIRES_IN_SECONDS = 7 * SECONDS_PER_DAY;
const DEFAULT_SESSION_UPDATE_AGE_SECONDS = SECONDS_PER_DAY;
const DEFAULT_SESSION_FRESH_AGE_SECONDS = 15 * SECONDS_PER_MINUTE;
const DEFAULT_SESSION_MAX_LIFETIME_SECONDS = 30 * SECONDS_PER_DAY;

const DEFAULT_DEV_ACTOR_ROLE = 'viewer';

const MIN_AUTH_SECRET_LENGTH = 32;

/**
 * An environment flag is the text `true` or `false`. `z.coerce.boolean()`
 * is not used: it turns every non-empty string, including "false", into `true`.
 */
const booleanFlagSchema = (defaultValue: boolean) =>
  z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? defaultValue : value === 'true'));

const commaSeparatedListSchema = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );

const positiveIntegerSchema = (defaultValue: number) =>
  z.coerce.number().int().positive().default(defaultValue);

const authEnvObjectSchema = z.object({
  AUTH_ENABLED: booleanFlagSchema(DEFAULT_AUTH_ENABLED),

  AUTH_SECRET: z.string().optional(),

  AUTH_DATABASE_URL: z.string().optional(),

  AUTH_DATABASE_POOL_SIZE: positiveIntegerSchema(DEFAULT_AUTH_DATABASE_POOL_SIZE),

  AUTH_SESSION_EXPIRES_IN_SECONDS: positiveIntegerSchema(DEFAULT_SESSION_EXPIRES_IN_SECONDS),

  AUTH_SESSION_UPDATE_AGE_SECONDS: positiveIntegerSchema(DEFAULT_SESSION_UPDATE_AGE_SECONDS),

  AUTH_SESSION_FRESH_AGE_SECONDS: positiveIntegerSchema(DEFAULT_SESSION_FRESH_AGE_SECONDS),

  AUTH_SESSION_MAX_LIFETIME_SECONDS: positiveIntegerSchema(DEFAULT_SESSION_MAX_LIFETIME_SECONDS),

  AUTH_TRUSTED_PROXIES: commaSeparatedListSchema,

  AUTH_DEV_ACTOR_ROLE: z.string().default(DEFAULT_DEV_ACTOR_ROLE),
});

/** A setting that must hold once auth is enabled. */
interface Requirement {
  readonly path: keyof AuthEnv;
  readonly isMet: (env: AuthEnv) => boolean;
  readonly message: string;
}

const REQUIREMENTS_WHEN_ENABLED: readonly Requirement[] = [
  {
    path: 'AUTH_SECRET',
    isMet: (env) => (env.AUTH_SECRET?.length ?? 0) >= MIN_AUTH_SECRET_LENGTH,
    message: `AUTH_SECRET is required and must be at least ${MIN_AUTH_SECRET_LENGTH} characters when auth is enabled.`,
  },
  {
    path: 'AUTH_DATABASE_URL',
    isMet: (env) => Boolean(env.AUTH_DATABASE_URL),
    message: 'AUTH_DATABASE_URL is required when auth is enabled.',
  },
  {
    path: 'AUTH_SESSION_UPDATE_AGE_SECONDS',
    isMet: (env) => env.AUTH_SESSION_UPDATE_AGE_SECONDS <= env.AUTH_SESSION_EXPIRES_IN_SECONDS,
    message: 'Must not exceed AUTH_SESSION_EXPIRES_IN_SECONDS.',
  },
  {
    path: 'AUTH_SESSION_FRESH_AGE_SECONDS',
    isMet: (env) => env.AUTH_SESSION_FRESH_AGE_SECONDS <= env.AUTH_SESSION_EXPIRES_IN_SECONDS,
    message: 'Must not exceed AUTH_SESSION_EXPIRES_IN_SECONDS.',
  },
  {
    path: 'AUTH_SESSION_MAX_LIFETIME_SECONDS',
    isMet: (env) => env.AUTH_SESSION_MAX_LIFETIME_SECONDS >= env.AUTH_SESSION_EXPIRES_IN_SECONDS,
    message: 'Must be at least AUTH_SESSION_EXPIRES_IN_SECONDS.',
  },
];

export const authEnvSchema = authEnvObjectSchema.superRefine((env, ctx) => {
  if (!env.AUTH_ENABLED) {
    return;
  }
  for (const requirement of REQUIREMENTS_WHEN_ENABLED) {
    if (!requirement.isMet(env)) {
      ctx.addIssue({ code: 'custom', path: [requirement.path], message: requirement.message });
    }
  }
});

export type AuthEnv = z.infer<typeof authEnvSchema>;
