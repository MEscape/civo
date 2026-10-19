import { z } from 'zod';

const DEFAULT_RATE_LIMIT_TIMEOUT_MS = 1500;
const MIN_RATE_LIMIT_TIMEOUT_MS = 100;
const MAX_RATE_LIMIT_TIMEOUT_MS = 10_000;
const MIN_RATE_LIMIT_SECRET_LENGTH = 32;

/**
 * Rate-limit configuration.
 *
 * `RATE_LIMIT_BACKEND` is deliberately optional: when unset it is `upstash` in
 * production and `memory` everywhere else (see `effectiveBackend`). The `memory`
 * backend keeps its counters in one process, so it is refused in production
 * rather than ever being chosen as a quiet fallback.
 *
 * The REST variables carry the names Upstash and its Vercel integration already
 * set, so a deployment needs no remapping. The key secret falls back to
 * `AUTH_SECRET`, so a deployment that already runs auth needs no new secret.
 */
export const rateLimitEnvSchema = z.object({
  RATE_LIMIT_BACKEND: z.enum(['upstash', 'memory']).optional(),

  /**
   * Where the client address of a request comes from (see `@lib/rate-limit`):
   * `vercel` trusts the platform's own `x-vercel-forwarded-for`, `proxies` strips
   * `x-forwarded-for` back through `AUTH_TRUSTED_PROXIES`, `none` resolves nothing.
   * Unset: `vercel` when running on Vercel (its `VERCEL` system variable is set),
   * else `proxies` when `AUTH_TRUSTED_PROXIES` is set, else `none`. There is no
   * setting that trusts an arbitrary header.
   */
  RATE_LIMIT_CLIENT_ADDRESS_SOURCE: z.enum(['vercel', 'proxies', 'none']).optional(),

  /**
   * Set by Vercel itself, at build and runtime, when "Automatically expose System
   * Environment Variables" is enabled for the project. Only used to pick the
   * `vercel` client-address source; it is a platform signal, not something a
   * request can set.
   */
  VERCEL: z.string().optional(),

  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  RATE_LIMIT_SECRET: z.string().optional(),

  /** Upper bound for one limiter check, including the round trip to the store. */
  RATE_LIMIT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(MIN_RATE_LIMIT_TIMEOUT_MS)
    .max(MAX_RATE_LIMIT_TIMEOUT_MS)
    .default(DEFAULT_RATE_LIMIT_TIMEOUT_MS),
});

export type RateLimitEnv = z.infer<typeof rateLimitEnvSchema>;

/** The settings that decide how the limiter is built: its own variables plus the ones it falls back to. */
export type RateLimitEnvInput = RateLimitEnv & {
  readonly NODE_ENV: 'development' | 'test' | 'production';
  readonly AUTH_SECRET?: string | undefined;
  readonly AUTH_TRUSTED_PROXIES?: readonly string[] | undefined;
};

export type ClientAddressSourceName = 'vercel' | 'proxies' | 'none';

/** How the client address of a request is determined. */
export interface ClientAddressSettings {
  readonly source: ClientAddressSourceName;
  /**
   * False only when the source is `none` because nothing was configured or detected. An operator
   * who wrote `none` made a decision; an unset variable on an unknown platform did not, and the
   * logs say so at warning level.
   */
  readonly configured: boolean;
  /** IPs or CIDR ranges of the proxies in front of the app; only used by `proxies`. */
  readonly trustedProxies: readonly string[];
}

export type RateLimitSettings =
  | {
      readonly backend: 'upstash';
      readonly restUrl: string;
      readonly restToken: string;
      readonly keySecret: string;
      readonly timeoutMs: number;
      readonly clientAddress: ClientAddressSettings;
    }
  | {
      /** Process-local counters. Development and tests only. */
      readonly backend: 'memory';
      /** Absent means the limiter generates a throw-away key for this process. */
      readonly keySecret: string | undefined;
      readonly timeoutMs: number;
      readonly clientAddress: ClientAddressSettings;
    };

export interface RateLimitConfigIssue {
  readonly path: keyof RateLimitEnv;
  readonly message: string;
}

/** An empty value (`RATE_LIMIT_SECRET=`) is the same as an unset one. */
function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value;
}

function effectiveBackend(env: RateLimitEnvInput): 'upstash' | 'memory' {
  return env.RATE_LIMIT_BACKEND ?? (env.NODE_ENV === 'production' ? 'upstash' : 'memory');
}

function effectiveSecret(env: RateLimitEnvInput): string | undefined {
  return nonEmpty(env.RATE_LIMIT_SECRET) ?? nonEmpty(env.AUTH_SECRET);
}

const restUrlSchema = z.url({ protocol: /^https?$/ });

/**
 * A trusted proxy is an IP address or an `IP/prefix` range; anything else would silently match
 * nothing. Checked with Zod's own validators rather than `node:net`: this file is part of the
 * `@lib/config` barrel that client components import, so it must not reach for a Node built-in.
 */
const proxyEntrySchema = z.union([z.ipv4(), z.ipv6(), z.cidrv4(), z.cidrv6()]);

function isValidProxyEntry(entry: string): boolean {
  return proxyEntrySchema.safeParse(entry).success;
}

function detectClientAddressSource(
  env: RateLimitEnvInput,
  trustedProxies: readonly string[],
): ClientAddressSourceName {
  if (nonEmpty(env.VERCEL) !== undefined) {
    return 'vercel';
  }
  return trustedProxies.length > 0 ? 'proxies' : 'none';
}

function effectiveClientAddress(env: RateLimitEnvInput): ClientAddressSettings {
  const trustedProxies = env.AUTH_TRUSTED_PROXIES ?? [];
  const explicit = env.RATE_LIMIT_CLIENT_ADDRESS_SOURCE;
  const source = explicit ?? detectClientAddressSource(env, trustedProxies);
  return {
    source,
    configured: explicit !== undefined || source !== 'none',
    trustedProxies: source === 'proxies' ? trustedProxies : [],
  };
}

function upstashIssues(env: RateLimitEnvInput): RateLimitConfigIssue[] {
  const issues: RateLimitConfigIssue[] = [];
  const restUrl = nonEmpty(env.UPSTASH_REDIS_REST_URL);

  if (restUrl === undefined) {
    issues.push({
      path: 'UPSTASH_REDIS_REST_URL',
      message: 'UPSTASH_REDIS_REST_URL is required for the upstash backend.',
    });
  } else if (!restUrlSchema.safeParse(restUrl).success) {
    issues.push({
      path: 'UPSTASH_REDIS_REST_URL',
      message: 'UPSTASH_REDIS_REST_URL must be an http(s) URL.',
    });
  }
  if (nonEmpty(env.UPSTASH_REDIS_REST_TOKEN) === undefined) {
    issues.push({
      path: 'UPSTASH_REDIS_REST_TOKEN',
      message: 'UPSTASH_REDIS_REST_TOKEN is required for the upstash backend.',
    });
  }
  return issues;
}

function backendIssues(env: RateLimitEnvInput): RateLimitConfigIssue[] {
  const backend = effectiveBackend(env);
  const secret = effectiveSecret(env);
  const secretIsWeak = (secret?.length ?? 0) < MIN_RATE_LIMIT_SECRET_LENGTH;

  if (backend === 'memory') {
    if (env.NODE_ENV === 'production') {
      return [
        {
          path: 'RATE_LIMIT_BACKEND',
          message:
            'The memory backend keeps counters per process and cannot enforce a limit across instances; it is not allowed when NODE_ENV=production.',
        },
      ];
    }
    return secret !== undefined && secretIsWeak
      ? [
          {
            path: 'RATE_LIMIT_SECRET',
            message: `A rate-limit secret, when set, must be at least ${MIN_RATE_LIMIT_SECRET_LENGTH} characters.`,
          },
        ]
      : [];
  }

  const issues = upstashIssues(env);
  if (secretIsWeak) {
    issues.push({
      path: 'RATE_LIMIT_SECRET',
      message: `RATE_LIMIT_SECRET (or AUTH_SECRET as its fallback) must be at least ${MIN_RATE_LIMIT_SECRET_LENGTH} characters for the upstash backend.`,
    });
  }
  return issues;
}

function clientAddressIssues(env: RateLimitEnvInput): RateLimitConfigIssue[] {
  const { source, trustedProxies } = effectiveClientAddress(env);
  if (source !== 'proxies') {
    return [];
  }

  if (trustedProxies.length === 0) {
    return [
      {
        path: 'RATE_LIMIT_CLIENT_ADDRESS_SOURCE',
        message:
          'The "proxies" source needs AUTH_TRUSTED_PROXIES (IPs or CIDR ranges of your proxies).',
      },
    ];
  }

  const invalid = trustedProxies.filter((entry) => !isValidProxyEntry(entry));
  return invalid.length === 0
    ? []
    : [
        {
          path: 'RATE_LIMIT_CLIENT_ADDRESS_SOURCE',
          message: `AUTH_TRUSTED_PROXIES contains entries that are not an IP or CIDR range: ${invalid.join(', ')}.`,
        },
      ];
}

/**
 * Everything that must hold for the rate limiter to start. Reported through the
 * server schema so a bad deployment fails at startup, not on the first request.
 */
export function rateLimitConfigIssues(env: RateLimitEnvInput): RateLimitConfigIssue[] {
  return [...backendIssues(env), ...clientAddressIssues(env)];
}

/**
 * The validated settings the limiter is built from. Throws when the environment
 * breaks `rateLimitConfigIssues`; the server schema reports the same problems
 * at startup, so reaching the throw means the schema was bypassed.
 */
export function resolveRateLimitSettings(env: RateLimitEnvInput): RateLimitSettings {
  const issues = rateLimitConfigIssues(env);
  if (issues.length > 0) {
    throw new Error(
      `Invalid rate-limit configuration:\n${issues.map((issue) => `  - ${issue.path}: ${issue.message}`).join('\n')}`,
    );
  }

  const common = {
    timeoutMs: env.RATE_LIMIT_TIMEOUT_MS,
    clientAddress: effectiveClientAddress(env),
  };
  if (effectiveBackend(env) === 'memory') {
    return { backend: 'memory', keySecret: effectiveSecret(env), ...common };
  }

  // `rateLimitConfigIssues` has just proved all three are present.
  const restUrl = nonEmpty(env.UPSTASH_REDIS_REST_URL);
  const restToken = nonEmpty(env.UPSTASH_REDIS_REST_TOKEN);
  const keySecret = effectiveSecret(env);
  if (restUrl === undefined || restToken === undefined || keySecret === undefined) {
    throw new Error('Invalid rate-limit configuration: Upstash URL, token or secret missing.');
  }
  return { backend: 'upstash', restUrl, restToken, keySecret, ...common };
}
