import { z } from 'zod';

import { authEnvObjectSchema } from './auth-env-schema';
import { booleanFlag, httpUrl, integerSetting } from './env-primitives';
import { refineEnv } from './env-rules';

import type { EnvRule } from './env-rules';
import type { ClientAddressSettings } from './rate-limit-settings';

/**
 * Who tells the application the client's address. Each platform source reads the one header that
 * platform sets itself; `proxies` reads `X-Forwarded-For` for anything else.
 */
export const CLIENT_ADDRESS_SOURCES = ['vercel', 'cloudflare', 'azure', 'proxies'] as const;

const DEFAULT_RATE_LIMIT_ENABLED = true;
const DEFAULT_RATE_LIMIT_TIMEOUT_MS = 1500;
const MIN_RATE_LIMIT_TIMEOUT_MS = 100;
const MAX_RATE_LIMIT_TIMEOUT_MS = 10_000;
const MIN_RATE_LIMIT_SECRET_LENGTH = 32;

/**
 * Rate-limit configuration.
 *
 * `RATE_LIMIT_ENABLED=false` turns the limiter off, as `AUTH_ENABLED=false` does for sign-in:
 * every attempt is allowed and no Redis is needed. It is refused in production (`env-schema.ts`).
 * While it is on, the shared store is Upstash Redis over REST; locally the `redis-rest` container
 * speaks the same protocol. There is no process-local backend: it could not enforce a limit
 * across instances.
 *
 * The REST variables carry the names Upstash and its Vercel integration already
 * set, so a deployment needs no remapping. The key secret falls back to
 * `AUTH_SECRET`, and the proxy list is auth's `AUTH_TRUSTED_PROXIES`: both are taken from the
 * authentication schema's own definitions, so this schema validates on its own like the others.
 *
 * Below the schema: what an unset variable means (`effective…`) and `rateLimitEnvRules`, what must
 * hold across the variables. How they become the limiter's settings is `rate-limit-settings.ts`.
 * What production demands (https, the limiter on) is in `env-schema.ts` with the other domains'.
 */
const rateLimitEnvObjectSchema = z.object({
  ...authEnvObjectSchema.pick({ AUTH_SECRET: true, AUTH_TRUSTED_PROXIES: true }).shape,

  /** `false` skips rate limiting entirely. Refused in production (see `env-schema.ts`). */
  RATE_LIMIT_ENABLED: booleanFlag(DEFAULT_RATE_LIMIT_ENABLED),

  /**
   * Who tells the application the client's address (see `@lib/rate-limit`). Required while the
   * limiter is on; nothing is guessed from the platform and nothing resolves to "no client":
   * - `vercel`: Vercel's own `x-vercel-forwarded-for`.
   * - `cloudflare`: Cloudflare's `cf-connecting-ip`.
   * - `azure`: Azure Front Door's `x-azure-clientip`.
   * - `proxies`: `x-forwarded-for` read from the right through `AUTH_TRUSTED_PROXIES`: Oracle
   *   Cloud load balancers, Azure Application Gateway and App Service, nginx, any proxy of your own.
   * A platform header is only trustworthy when the application can be reached through that
   * platform alone; `proxies` is only sound when it is reachable solely through the listed proxies.
   */
  RATE_LIMIT_CLIENT_ADDRESS_SOURCE: z.enum(CLIENT_ADDRESS_SOURCES).optional(),

  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  RATE_LIMIT_SECRET: z.string().optional(),

  /** Upper bound for one limiter check, including the round trip to the store. */
  RATE_LIMIT_TIMEOUT_MS: integerSetting(DEFAULT_RATE_LIMIT_TIMEOUT_MS, {
    min: MIN_RATE_LIMIT_TIMEOUT_MS,
    max: MAX_RATE_LIMIT_TIMEOUT_MS,
  }),
});

/** The rate-limit variables, plus the two it shares with authentication, validated and typed. */
export type RateLimitEnv = z.infer<typeof rateLimitEnvObjectSchema>;

/*
 * What an unset variable means, in one place: the rules below and `resolveRateLimitSettings` both
 * read it from here.
 */

/** An empty value (`RATE_LIMIT_SECRET=`) is the same as an unset one. */
export function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value;
}

/** The key secret: `RATE_LIMIT_SECRET`, else `AUTH_SECRET`. */
export function effectiveSecret(env: RateLimitEnv): string | undefined {
  return nonEmpty(env.RATE_LIMIT_SECRET) ?? nonEmpty(env.AUTH_SECRET);
}

/** How the client address is read, or `undefined` while no source is chosen (a rule reports that). */
export function effectiveClientAddress(env: RateLimitEnv): ClientAddressSettings | undefined {
  const source = env.RATE_LIMIT_CLIENT_ADDRESS_SOURCE;
  if (source === undefined) {
    return undefined;
  }
  return { source, trustedProxies: source === 'proxies' ? env.AUTH_TRUSTED_PROXIES : [] };
}

/**
 * A trusted proxy is an IP address or an `IP/prefix` range; anything else would silently match
 * nothing. Checked with Zod's own validators rather than `node:net`, which keeps this module free
 * of Node built-ins and so loadable in any runtime the server configuration is read from.
 */
const proxyEntrySchema = z.union([z.ipv4(), z.ipv6(), z.cidrv4(), z.cidrv6()]);

const restUrl = (env: RateLimitEnv) => nonEmpty(env.UPSTASH_REDIS_REST_URL);
const isWeak = (secret: string | undefined) => (secret?.length ?? 0) < MIN_RATE_LIMIT_SECRET_LENGTH;

/** The limiter is off in development only, and then none of its settings matter. */
const whileEnabled = (breaks: (env: RateLimitEnv) => boolean) => (env: RateLimitEnv) =>
  env.RATE_LIMIT_ENABLED && breaks(env);

function malformedProxies(env: RateLimitEnv): string[] {
  return (effectiveClientAddress(env)?.trustedProxies ?? []).filter(
    (entry) => !proxyEntrySchema.safeParse(entry).success,
  );
}

/**
 * What must hold for the rate limiter to start. Reported through the server schema, so a bad
 * deployment fails at startup, not on the first request.
 */
export const rateLimitEnvRules: ReadonlyArray<EnvRule<RateLimitEnv>> = [
  {
    path: 'UPSTASH_REDIS_REST_URL',
    violated: whileEnabled((env) => restUrl(env) === undefined),
    message: 'UPSTASH_REDIS_REST_URL is required while rate limiting is enabled.',
  },
  {
    path: 'UPSTASH_REDIS_REST_URL',
    violated: whileEnabled((env) => {
      const url = restUrl(env);
      return url !== undefined && !httpUrl.safeParse(url).success;
    }),
    message: 'UPSTASH_REDIS_REST_URL must be an http(s) URL.',
  },
  {
    path: 'UPSTASH_REDIS_REST_TOKEN',
    violated: whileEnabled((env) => nonEmpty(env.UPSTASH_REDIS_REST_TOKEN) === undefined),
    message: 'UPSTASH_REDIS_REST_TOKEN is required while rate limiting is enabled.',
  },

  {
    path: 'RATE_LIMIT_SECRET',
    violated: whileEnabled((env) => isWeak(effectiveSecret(env))),
    message: `RATE_LIMIT_SECRET (or AUTH_SECRET as its fallback) must be at least ${MIN_RATE_LIMIT_SECRET_LENGTH} characters while rate limiting is enabled.`,
  },

  {
    path: 'RATE_LIMIT_CLIENT_ADDRESS_SOURCE',
    violated: whileEnabled((env) => effectiveClientAddress(env) === undefined),
    message: `RATE_LIMIT_CLIENT_ADDRESS_SOURCE is required while rate limiting is enabled: ${CLIENT_ADDRESS_SOURCES.join(', ')}.`,
  },
  {
    path: 'RATE_LIMIT_CLIENT_ADDRESS_SOURCE',
    violated: whileEnabled(
      (env) =>
        env.RATE_LIMIT_CLIENT_ADDRESS_SOURCE === 'proxies' && env.AUTH_TRUSTED_PROXIES.length === 0,
    ),
    message:
      'The "proxies" source needs AUTH_TRUSTED_PROXIES (IPs or CIDR ranges of your proxies).',
  },
  {
    path: 'RATE_LIMIT_CLIENT_ADDRESS_SOURCE',
    violated: whileEnabled((env) => malformedProxies(env).length > 0),
    message: (env) =>
      `AUTH_TRUSTED_PROXIES contains entries that are not an IP or CIDR range: ${malformedProxies(env).join(', ')}.`,
  },
];

/** The rate-limit variables with their cross-variable rules; composed into the server schema. */
export const rateLimitEnvSchema = rateLimitEnvObjectSchema.superRefine(
  refineEnv(rateLimitEnvRules),
);
