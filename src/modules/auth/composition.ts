import 'server-only';
import { cache } from 'react';

import { headers } from 'next/headers';
import { connection } from 'next/server';

import { withAuditTrail } from '@modules/audit';

import type { Locale } from '@i18n';

import { systemClock } from '@lib/clock';
import { APP_IDENTITY, publicEnv } from '@lib/config';
import { serverEnv } from '@lib/config/server';
import type { ServerEnv } from '@lib/config/server';
import { logger } from '@lib/logger';
import { getMailTransport } from '@lib/mail/server';
import { getClientAddressProvider, getRateLimiter } from '@lib/rate-limit';
import { ResultAsync } from '@lib/result';
import { toLocalizedPath } from '@lib/seo';
import { TENANT_HINT_HEADER } from '@lib/tenancy';
import { invariant, isDefined, once } from '@lib/utils';

import { createAuthorizationService } from './application/authorization-service';
import { AcceptInvitation } from './application/commands/accept-invitation';
import { ChangeUserRoles } from './application/commands/change-user-roles';
import { GrantPlatformAdmin } from './application/commands/grant-platform-admin';
import { InviteBootstrapAdmins } from './application/commands/invite-bootstrap-admins';
import { InviteUser } from './application/commands/invite-user';
import { RemoveUser } from './application/commands/remove-user';
import { RemoveUserAccess } from './application/commands/remove-user-access';
import { RequestPasswordReset } from './application/commands/request-password-reset';
import { ResetPassword } from './application/commands/reset-password';
import { RevokeInvitation } from './application/commands/revoke-invitation';
import { RevokePlatformAdmin } from './application/commands/revoke-platform-admin';
import { SetUserAccess } from './application/commands/set-user-access';
import { SignIn } from './application/commands/sign-in';
import { SignOut } from './application/commands/sign-out';
import { GetCurrentActor } from './application/queries/get-current-actor';
import { GetMemberSummary } from './application/queries/get-member-summary';
import { ListInvitations } from './application/queries/list-invitations';
import { ListPlatformAdmins } from './application/queries/list-platform-admins';
import { ListPlatformUsers } from './application/queries/list-platform-users';
import { ListUsers } from './application/queries/list-users';
import { PreviewInvitation } from './application/queries/preview-invitation';
import { ResolveMemberNames } from './application/queries/resolve-member-names';
import { actorHasPermission } from './domain/models/authorize';
import { PLATFORM_ADMIN_ROLE, isAnyRole } from './domain/models/role';
import { PLATFORM_TENANT_ID, UNASSIGNED_TENANT_ID } from './domain/models/tenant';
import { authenticationApiFrom } from './infrastructure/better-auth/better-auth-authentication-api';
import { BetterAuthAuthenticator } from './infrastructure/better-auth/better-auth-authenticator';
import { BetterAuthCurrentActorProvider } from './infrastructure/better-auth/better-auth-current-actor-provider';
import { sessionSourceFrom } from './infrastructure/better-auth/better-auth-session-source';
import { createAuth } from './infrastructure/better-auth/create-auth';
import { createAuthRouteHandlers } from './infrastructure/better-auth/create-auth-route-handlers';
import { Sha256TokenGenerator } from './infrastructure/crypto/sha256-token-generator';
import { DevCurrentActorProvider } from './infrastructure/dev/dev-current-actor-provider';
import {
  LEVEL_BY_EVENT,
  TRAIL_BY_EVENT,
  loggerSecurityAuditLog,
} from './infrastructure/logging/logger-security-audit-log';
import { TransactionalAuthMailer } from './infrastructure/mail/transactional-auth-mailer';
import { UnconfiguredAuthMailer } from './infrastructure/mail/unconfigured-auth-mailer';
import { getAuthPool } from './infrastructure/pg/auth-pool';
import { PgUserDirectory } from './infrastructure/pg/pg-user-directory';
import { PrismaInvitationRepository } from './infrastructure/prisma/prisma-invitation.repository';
import { PrismaMembershipRepository } from './infrastructure/prisma/prisma-membership.repository';
import { PrismaTenantRepository } from './infrastructure/prisma/prisma-tenant.repository';
import { authRoutes } from './presentation/routes';

import type {
  AuthenticationDependencies,
  PlatformAccessDependencies,
  UserAdministrationDependencies,
} from './application/auth-dependencies';
import type { AuthorizationService } from './application/authorization-service';
import type { TenantId } from './domain/models/ids';
import type { Permission } from './domain/models/permission';
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
 * The website a request is about, as `proxy.ts` set it from the address. Only a
 * platform administrator (and the loopback-only dev actor) is resolved by it.
 */
async function readTenantHint(): Promise<string | null> {
  return (await headers()).get(TENANT_HINT_HEADER);
}

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
  if (isAnyRole(raw)) {
    return raw;
  }
  throw new Error(`AUTH_DEV_ACTOR_ROLE "${raw}" is not a known role.`);
}

function buildMailer(): AuthMailer {
  const transport = getMailTransport();
  return transport === null
    ? new UnconfiguredAuthMailer()
    : new TransactionalAuthMailer(transport, {
        appName: APP_IDENTITY.name,
        invitationLink: (locale, token) => {
          const link = new URL(
            toLocalizedPath(locale, authRoutes.acceptInvitation()),
            publicEnv.NEXT_PUBLIC_APP_URL,
          );
          link.searchParams.set('token', token);
          return link.toString();
        },
        signInLink: (locale) =>
          new URL(
            toLocalizedPath(locale, authRoutes.signIn()),
            publicEnv.NEXT_PUBLIC_APP_URL,
          ).toString(),
      });
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

/** The module's audit port: its log lines, and the trail the website's audit page reads. */
const auditLog = withAuditTrail(loggerSecurityAuditLog, {
  source: 'auth',
  levels: LEVEL_BY_EVENT,
  policy: TRAIL_BY_EVENT,
  isWebsite: (tenantId) => tenantId !== PLATFORM_TENANT_ID && tenantId !== UNASSIGNED_TENANT_ID,
});

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
    audit: auditLog,
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
        getTenantHint: readTenantHint,
        nodeEnv: serverEnv.NODE_ENV,
        appUrl: publicEnv.NEXT_PUBLIC_APP_URL,
      }),
    );
  }
  return new BetterAuthCurrentActorProvider({
    sessions: sessionSourceFrom(getAuth),
    memberships: getMemberships(),
    getHeaders: () => headers(),
    sessionMaxLifetimeMs: serverEnv.AUTH_SESSION_MAX_LIFETIME_SECONDS * MILLISECONDS_PER_SECOND,
    clock: systemClock,
    platformAdminEmails: new Set(serverEnv.AUTH_PLATFORM_ADMIN_EMAILS),
    getTenantHint: readTenantHint,
  });
}

/** One memoized provider per process, shared by authorization and the actor query. */
const getCurrentActorProvider = once(() => memoizePerRequest(buildCurrentActorProvider()));

/** What use cases of other modules receive. Per-request state lives in `headers()`. */
export const getAccessControl = once<AuthorizationService>(() =>
  createAuthorizationService({
    currentActor: getCurrentActorProvider(),
    audit: auditLog,
  }),
);

/**
 * Which of `candidates` the signed-in actor holds, for screens that show only
 * what the actor may use (the section tabs). Display only: every use case
 * still authorizes on its own, so a hidden tab is never the protection. An
 * unknown or signed-out actor holds none.
 */
export async function getHeldPermissions(
  candidates: readonly Permission[],
): Promise<ReadonlySet<Permission>> {
  const actor = await getCurrentActorProvider().getCurrentActor();
  return new Set(
    actor.isOk()
      ? candidates.filter((permission) => actorHasPermission(actor.value, permission))
      : [],
  );
}

/**
 * The tenant the signed-in actor is working in (a tenant is its website), or
 * `null` when nobody is signed in or the actor stands in no tenant: a platform
 * administrator on a screen with no website open, or someone with no
 * membership. For screens that route by tenant; like `getHeldPermissions` it
 * decides nothing.
 */
export async function getCurrentTenantId(): Promise<string | null> {
  const actor = await getCurrentActorProvider().getCurrentActor();
  if (actor.isErr()) {
    return null;
  }
  const { tenantId } = actor.value;
  return tenantId === PLATFORM_TENANT_ID || tenantId === UNASSIGNED_TENANT_ID ? null : tenantId;
}

/**
 * Every tenant the signed-in person holds a role in (never the platform scope),
 * oldest first, taken from their memberships alone: nothing in the request
 * adds to it. Empty when nobody is signed in, and for a platform administrator,
 * who belongs to no tenant in particular and sees them all. For screens that
 * let someone with several tenants choose one; like `getHeldPermissions` it
 * decides nothing.
 */
export async function getMemberTenantIds(): Promise<readonly TenantId[]> {
  const actor = await getCurrentActorProvider().getCurrentActor();
  if (actor.isErr() || actor.value.roles.includes(PLATFORM_ADMIN_ROLE)) {
    return [];
  }
  const tenants = await getMemberships().findTenantsOf(actor.value.id);
  return tenants.isOk() ? tenants.value : [];
}

/**
 * Everything user administration is built from. The user directory opens the
 * auth pool only when it is first asked, so building this needs no auth
 * configuration (the screens answer 404 while AUTH_ENABLED=false).
 */
const getAdministrationDependencies = once((): UserAdministrationDependencies => ({
  authorization: getAccessControl(),
  members: getMemberships(),
  directory: new PgUserDirectory(getPool),
  invitations: new PrismaInvitationRepository(),
  tokens: new Sha256TokenGenerator(),
  mailer: getMailer(),
  audit: auditLog,
  clock: systemClock,
}));

export const getAuthQueries = once(
  () =>
    ({
      getCurrentActor: new GetCurrentActor({
        currentActor: getCurrentActorProvider(),
      }),
      listUsers: new ListUsers(getAdministrationDependencies()),
      resolveMemberNames: new ResolveMemberNames(getAdministrationDependencies()),
      listPlatformAdmins: new ListPlatformAdmins(getAdministrationDependencies()),
      listInvitations: new ListInvitations(getAdministrationDependencies()),
      getMemberSummary: new GetMemberSummary(getAdministrationDependencies()),
      previewInvitation: new PreviewInvitation(getAdministrationDependencies()),
      listPlatformUsers: new ListPlatformUsers(getAdministrationDependencies()),
    }) as const,
);

/**
 * Sign-in, sign-up, sign-out and password reset. Only meaningful while
 * AUTH_ENABLED=true; the pages that host them answer 404 otherwise, and
 * calling this with auth disabled is a programmer error that throws.
 */
const getAuthenticationDependencies = once((): AuthenticationDependencies => {
  const dependencies: AuthenticationDependencies = {
    authenticator: new BetterAuthAuthenticator({
      api: authenticationApiFrom(getAuth()),
      getHeaders: () => headers(),
      paths: {
        afterEmailVerification: authRoutes.emailVerified(),
        passwordReset: authRoutes.resetPassword(),
      },
    }),
    rateLimiter: getRateLimiter(),
    clientAddress: getClientAddressProvider(() => headers()),
    audit: auditLog,
  };
  return dependencies;
});

export const getAuthCommands = once(() => {
  const dependencies = getAuthenticationDependencies();
  const administration = getAdministrationDependencies();
  const platformAccess: PlatformAccessDependencies = {
    authorization: administration.authorization,
    members: administration.members,
    directory: administration.directory,
    audit: administration.audit,
    tenants: new PrismaTenantRepository(),
  };

  return {
    signIn: new SignIn(dependencies),
    signOut: new SignOut(dependencies),
    requestPasswordReset: new RequestPasswordReset(dependencies),
    resetPassword: new ResetPassword(dependencies),
    inviteUser: new InviteUser({ ...administration, rateLimiter: getRateLimiter() }),
    changeUserRoles: new ChangeUserRoles(administration),
    removeUser: new RemoveUser(administration),
    setUserAccess: new SetUserAccess(platformAccess),
    removeUserAccess: new RemoveUserAccess(platformAccess),
    grantPlatformAdmin: new GrantPlatformAdmin(administration),
    revokePlatformAdmin: new RevokePlatformAdmin(administration),
    revokeInvitation: new RevokeInvitation(administration),
    acceptInvitation: new AcceptInvitation({
      ...dependencies,
      invitations: administration.invitations,
      tokens: administration.tokens,
      members: administration.members,
      directory: administration.directory,
      clock: administration.clock,
    }),
  } as const;
});

/** For `app/api/auth/[...all]/route.ts`: the emailed links are the HTTP consumer. */
export const authRouteHandlers = createAuthRouteHandlers({
  isEnabled: serverEnv.AUTH_ENABLED,
  getAuth,
});

/**
 * Work the server does once when it starts. With sign-up closed, the
 * platform administrators named in `AUTH_PLATFORM_ADMIN_EMAILS` have no way
 * to open an account, so each of them that has none is mailed a link to
 * create one (`InviteBootstrapAdmins`). Needs authentication and a mail
 * provider; without either it says so in the log and does nothing. A failure
 * is logged, never thrown: the application must start with or without it.
 */
/** The language of the first mail, before anyone has chosen one: the platform's default locale. */
const BOOTSTRAP_MAIL_LOCALE: Locale = 'en';

export async function runAuthStartup(): Promise<void> {
  const emails = serverEnv.AUTH_PLATFORM_ADMIN_EMAILS;
  if (!serverEnv.AUTH_ENABLED || emails.length === 0) {
    return;
  }
  if (serverEnv.MAIL_PROVIDER === 'none') {
    logger.warn('auth.bootstrap_skipped', { reason: 'MAIL_PROVIDER is none' });
    return;
  }
  try {
    const outcome = await new InviteBootstrapAdmins(getAdministrationDependencies()).execute({
      emails,
      locale: BOOTSTRAP_MAIL_LOCALE,
    });
    if (outcome.isOk()) {
      const { invited, skipped, failed } = outcome.value;
      logger.info('auth.bootstrap_platform_admins', { invited, skipped, failed });
    }
  } catch (error) {
    logger.error('auth.bootstrap_failed', { error });
  }
}
