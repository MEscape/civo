import { effectiveClientAddress, effectiveSecret, nonEmpty } from './rate-limit-env-schema';

import type { CLIENT_ADDRESS_SOURCES, RateLimitEnv } from './rate-limit-env-schema';

/** Who tells the application the client's address; the list lives with the variable that names it. */
export type ClientAddressSourceName = (typeof CLIENT_ADDRESS_SOURCES)[number];

/** How the client address of a request is determined. There is no source that resolves nothing. */
export interface ClientAddressSettings {
  readonly source: ClientAddressSourceName;
  /** IPs or CIDR ranges of the proxies in front of the app; only used by `proxies`. */
  readonly trustedProxies: readonly string[];
}

/** What the limiter is built from: off, or the shared store and how to key and read clients. */
export type RateLimitSettings =
  | {
      /** `RATE_LIMIT_ENABLED=false`: nothing is counted and no store is reached. */
      readonly enabled: false;
    }
  | {
      readonly enabled: true;
      readonly restUrl: string;
      readonly restToken: string;
      readonly keySecret: string;
      readonly timeoutMs: number;
      readonly clientAddress: ClientAddressSettings;
    };

/**
 * The settings the limiter is built from. `env` is the validated server configuration: the rules
 * in `rate-limit-env-schema.ts` have already refused every combination this cannot build from, at
 * startup, so the only failure left here is a narrowing the types cannot see.
 */
export function resolveRateLimitSettings(env: RateLimitEnv): RateLimitSettings {
  if (!env.RATE_LIMIT_ENABLED) {
    return { enabled: false };
  }

  const restUrl = nonEmpty(env.UPSTASH_REDIS_REST_URL);
  const restToken = nonEmpty(env.UPSTASH_REDIS_REST_TOKEN);
  const keySecret = effectiveSecret(env);
  const clientAddress = effectiveClientAddress(env);
  if (
    restUrl === undefined ||
    restToken === undefined ||
    keySecret === undefined ||
    clientAddress === undefined
  ) {
    throw new Error(
      'Invalid rate-limit configuration: Upstash URL, token, secret or client address source missing.',
    );
  }
  return {
    enabled: true,
    restUrl,
    restToken,
    keySecret,
    timeoutMs: env.RATE_LIMIT_TIMEOUT_MS,
    clientAddress,
  };
}
