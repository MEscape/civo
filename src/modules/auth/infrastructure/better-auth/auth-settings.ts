import { publicEnv } from '@lib/config';
import type { ServerEnv } from '@lib/config/server';
import { invariant, isDefined } from '@lib/utils';

import type { AuthSettings } from './create-auth';

/** The two values real authentication cannot run without, checked where the environment becomes settings. */
export function requireAuthCredentials(env: ServerEnv): {
  readonly secret: string;
  readonly databaseUrl: string;
} {
  const { AUTH_SECRET: secret, AUTH_DATABASE_URL: databaseUrl } = env;
  // The env schema guarantees both when AUTH_ENABLED=true; this narrows the
  // type and fails fast if that guarantee is ever removed.
  invariant(
    isDefined(secret) && isDefined(databaseUrl),
    'AUTH_SECRET and AUTH_DATABASE_URL are required when AUTH_ENABLED=true.',
  );
  return { secret, databaseUrl };
}

export function toAuthSettings(env: ServerEnv): AuthSettings {
  return {
    baseUrl: publicEnv.NEXT_PUBLIC_APP_URL,
    secret: requireAuthCredentials(env).secret,
    isProduction: env.NODE_ENV === 'production',
    trustedProxies: env.AUTH_TRUSTED_PROXIES,
    session: {
      expiresInSeconds: env.AUTH_SESSION_EXPIRES_IN_SECONDS,
      updateAgeSeconds: env.AUTH_SESSION_UPDATE_AGE_SECONDS,
      freshAgeSeconds: env.AUTH_SESSION_FRESH_AGE_SECONDS,
    },
  };
}
