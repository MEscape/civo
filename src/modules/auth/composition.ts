import 'server-only';
import { cache } from 'react';

import { headers } from 'next/headers';
import { connection } from 'next/server';

import { systemClock } from '@lib/clock';
import { APP_IDENTITY, publicEnv } from '@lib/config';
import { serverEnv } from '@lib/config/server';
import type { ServerEnv } from '@lib/config/server';
import { getMailTransport } from '@lib/mail/server';
import { ResultAsync } from '@lib/result';
import { invariant, isDefined, once } from '@lib/utils';

import { createAuthorizationService } from './application/authorization-service';
import { RequestPasswordReset } from './application/commands/request-password-reset';
import { ResetPassword } from './application/commands/reset-password';
import { SignIn } from './application/commands/sign-in';
import { SignOut } from './application/commands/sign-out';
import { SignUp } from './application/commands/sign-up';
import { GetCurrentActor } from './application/queries/get-current-actor';
import { toTenantId } from './domain/models/ids';
import { isRole } from './domain/models/role';
import { authenticationApiFrom } from './infrastructure/better-auth/better-auth-authentication-api';
import { BetterAuthAuthenticator } from './infrastructure/better-auth/better-auth-authenticator';
import { BetterAuthCurrentActorProvider } from './infrastructure/better-auth/better-auth-current-actor-provider';
import { sessionSourceFrom } from './infrastructure/better-auth/better-auth-session-source';
import { createAuth } from './infrastructure/better-auth/create-auth';
import { createAuthRouteHandlers } from './infrastructure/better-auth/create-auth-route-handlers';
import { DevCurrentActorProvider } from './infrastructure/dev/dev-current-actor-provider';
import { loggerSecurityAuditLog } from './infrastructure/logging/logger-security-audit-log';
import { TransactionalAuthMailer } from './infrastructure/mail/transactional-auth-mailer';
import { UnconfiguredAuthMailer } from './infrastructure/mail/unconfigured-auth-mailer';
import { getAuthPool } from './infrastructure/pg/auth-pool';
import { PgAuthRateLimiter } from './infrastructure/pg/pg-auth-rate-limiter';
import { PrismaMembershipRepository } from './infrastructure/prisma/prisma-membership.repository';
import { authRoutes } from './presentation/routes';

import type { AuthenticationDependencies } from './application/auth-dependencies';
import type { AuthorizationService } from './application/authorization-service';
import type { Role } from './domain/models/role';
import type { AuthMailer } from './domain/ports/auth-mailer.port';
import type { CurrentActorProvider } from './domain/ports/current-actor-provider.port';
import type { MembershipRepository } from './domain/ports/membership.repository';
import type { AuthSettings, BetterAuthInstance } from './infrastructure/better-auth/create-auth';

/**
 * Composition root for authentication and access control, at the framework
 * boundary. It is the ONLY file that knows which authentication
 * implementation runs, and the only place that branches on `AUTH_ENABLED`;
 * every other file receives a port or an application service and cannot
 * tell which. Everything is built lazily (`once`), so importing this file
 * during `next build` needs no auth configuration.
 *
 * `server-only` makes an accidental import from a Client Component a
 * build error.
 */

const MILLISECONDS_PER_SECOND = 1000;

/**
 * The single tenant every actor belongs to until real multi-tenancy ships.
 * It must match the `tenantId` of the membership rows (see
 * migrations/app/0001_membership.sql). Adopting real tenants later changes
 * where this value comes from, not any call site.
 */
const DEFAULT_TENANT_ID = toTenantId('default');

function requireAuthCredentials(env: ServerEnv): {
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

function toAuthSettings(env: ServerEnv): AuthSettings {
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

// Env input, so this is an explicit error rather than an invariant.
function resolveDevActorRole(raw: string): Role {
  if (isRole(raw)) {
    return raw;
  }
  throw new Error(`AUTH_DEV_ACTOR_ROLE "${raw}" is not a known role.`);
}

function buildMailer(): AuthMailer {
  const transport = getMailTransport();
  return transport === null
    ? new UnconfiguredAuthMailer()
    : new TransactionalAuthMailer(transport, { appName: APP_IDENTITY.name });
}

const getMailer = once<AuthMailer>(buildMailer);

const getMemberships = once<MembershipRepository>(() => new PrismaMembershipRepository());

const getPool = once(() =>
  getAuthPool({
    databaseUrl: requireAuthCredentials(serverEnv).databaseUrl,
    maxConnections: serverEnv.AUTH_DATABASE_POOL_SIZE,
    reuseAcrossReloads: serverEnv.NODE_ENV !== 'production',
  }),
);

/** Whether real authentication runs. Pages for sign-in and sign-up use it to answer 404 when it does not. */
export const isAuthEnabled: boolean = serverEnv.AUTH_ENABLED;

/**
 * The Better Auth instance. Throws when auth is disabled: there is nothing
 * to hand out.
 */
const getAuth = once<BetterAuthInstance>(() => {
  if (!serverEnv.AUTH_ENABLED) {
    throw new Error('Better Auth is not available while AUTH_ENABLED=false.');
  }
  return createAuth(toAuthSettings(serverEnv), {
    pool: getPool(),
    mailer: getMailer(),
    audit: loggerSecurityAuditLog,
  });
});

/**
 * Resolving the actor costs a session lookup plus a membership query. React's
 * `cache` collapses repeats within ONE server render or action into a
 * single lookup, and never outlives the request, so a role change is still
 * visible on the next request. Do not swap it for a longer-lived cache
 * (caching.md: authorization decisions need an explicit identity boundary).
 */
function memoizePerRequest(provider: CurrentActorProvider): CurrentActorProvider {
  const resolve = cache(() => provider.getCurrentActor());
  return { getCurrentActor: () => resolve() };
}

/**
 * Knowing the actor is request-time work. A real session lookup reads
 * `headers()`, which keeps everything that depends on the actor out of
 * prerendering; the fixed dev actor reads nothing, so without this a protected
 * page would prerender and run its database queries at build time.
 */
function requestScoped(provider: CurrentActorProvider): CurrentActorProvider {
  return {
    getCurrentActor: () =>
      ResultAsync.fromSafePromise(connection()).andThen(() => provider.getCurrentActor()),
  };
}

function buildCurrentActorProvider(): CurrentActorProvider {
  if (!serverEnv.AUTH_ENABLED) {
    return requestScoped(
      new DevCurrentActorProvider({
        role: resolveDevActorRole(serverEnv.AUTH_DEV_ACTOR_ROLE),
        tenantId: DEFAULT_TENANT_ID,
        nodeEnv: serverEnv.NODE_ENV,
        appUrl: publicEnv.NEXT_PUBLIC_APP_URL,
      }),
    );
  }
  return new BetterAuthCurrentActorProvider({
    sessions: sessionSourceFrom(getAuth()),
    memberships: getMemberships(),
    getHeaders: () => headers(),
    sessionMaxLifetimeMs: serverEnv.AUTH_SESSION_MAX_LIFETIME_SECONDS * MILLISECONDS_PER_SECOND,
    clock: systemClock,
    tenantId: DEFAULT_TENANT_ID,
  });
}

/** One memoized provider per process, shared by authorization and the actor query. */
const getCurrentActorProvider = once(() => memoizePerRequest(buildCurrentActorProvider()));

/** What use cases of other modules receive. Per-request state lives in `headers()`. */
export const getAccessControl = once<AuthorizationService>(() =>
  createAuthorizationService({
    currentActor: getCurrentActorProvider(),
    audit: loggerSecurityAuditLog,
  }),
);

export const getAuthQueries = once(
  () =>
    ({
      getCurrentActor: new GetCurrentActor({
        currentActor: getCurrentActorProvider(),
      }),
    }) as const,
);

/**
 * Sign-in, sign-up, sign-out and password reset. Only meaningful while
 * AUTH_ENABLED=true; the pages that host them answer 404 otherwise, and
 * calling this with auth disabled is a programmer error that throws.
 */
export const getAuthCommands = once(() => {
  const dependencies: AuthenticationDependencies = {
    authenticator: new BetterAuthAuthenticator({
      api: authenticationApiFrom(getAuth()),
      getHeaders: () => headers(),
      paths: {
        afterEmailVerification: authRoutes.emailVerified(),
        passwordReset: authRoutes.resetPassword(),
      },
    }),
    rateLimiter: new PgAuthRateLimiter(getPool(), requireAuthCredentials(serverEnv).secret),
    audit: loggerSecurityAuditLog,
  };

  return {
    signIn: new SignIn(dependencies),
    signUp: new SignUp(dependencies),
    signOut: new SignOut(dependencies),
    requestPasswordReset: new RequestPasswordReset(dependencies),
    resetPassword: new ResetPassword(dependencies),
  } as const;
});

/** For `app/api/auth/[...all]/route.ts`: the emailed links are the HTTP consumer. */
export const authRouteHandlers = createAuthRouteHandlers({
  isEnabled: serverEnv.AUTH_ENABLED,
  getAuth,
});
