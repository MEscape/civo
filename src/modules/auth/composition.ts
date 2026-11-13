import 'server-only';

import { randomUUID } from 'node:crypto';

import { headers } from 'next/headers';

import { setAuditAccessAdapter, withAuditTrail } from '@modules/audit';

import type { Locale } from '@i18n';

import { systemClock } from '@lib/clock';
import { APP_IDENTITY, publicEnv } from '@lib/config';
import { serverEnv } from '@lib/config/server';
import { logger } from '@lib/logger';
import { getMailTransport } from '@lib/mail/server';
import { getClientAddressProvider, getRateLimiter } from '@lib/rate-limit';
import { errAsync } from '@lib/result';
import { toLocalizedPath } from '@lib/seo';
import { getObjectStore } from '@lib/storage/server';
import { TENANT_HINT_HEADER, isWebsiteId } from '@lib/tenancy';
import { MS_PER_SECOND, once } from '@lib/utils';

import { createAuthorizationService } from './application/authorization-service';
import { AcceptInvitation } from './application/commands/accept-invitation';
import { AdmitLinkRequest } from './application/commands/admit-link-request';
import { GrantPlatformAdmin } from './application/commands/grant-platform-admin';
import { InviteBootstrapAdmins } from './application/commands/invite-bootstrap-admins';
import { InviteUser } from './application/commands/invite-user';
import { RemoveUserAccess } from './application/commands/remove-user-access';
import { RequestPasswordReset } from './application/commands/request-password-reset';
import { ResetPassword } from './application/commands/reset-password';
import { RevokeInvitation } from './application/commands/revoke-invitation';
import { RevokePlatformAdmin } from './application/commands/revoke-platform-admin';
import { SetUserAccess } from './application/commands/set-user-access';
import { SignIn } from './application/commands/sign-in';
import { SignOut } from './application/commands/sign-out';
import { UpdateOwnProfile } from './application/commands/update-own-profile';
import { AuthorizeWebsiteAccess } from './application/queries/authorize-website-access';
import { GetCurrentActor } from './application/queries/get-current-actor';
import { GetMemberSummary } from './application/queries/get-member-summary';
import { GetOwnProfile } from './application/queries/get-own-profile';
import { ListAccessibleWebsites } from './application/queries/list-accessible-websites';
import { ListEmployees } from './application/queries/list-employees';
import { ListInvitations } from './application/queries/list-invitations';
import { ListManageableWebsites } from './application/queries/list-manageable-websites';
import { ListPlatformUsers } from './application/queries/list-platform-users';
import { ListUsers } from './application/queries/list-users';
import { PreviewInvitation } from './application/queries/preview-invitation';
import { ResolveMemberNames } from './application/queries/resolve-member-names';
import { unauthenticated } from './domain/errors/auth-errors';
import { actorHasPermission } from './domain/models/authorize';
import { PLATFORM_TENANT_ID, UNASSIGNED_TENANT_ID } from './domain/models/tenant';
import { AuthAuditAccess } from './infrastructure/access/auth-audit-access';
import {
  LEVEL_BY_EVENT,
  TRAIL_BY_EVENT,
  loggerSecurityAuditLog,
} from './infrastructure/audit/logger-security-audit-log';
import { requireAuthCredentials, toAuthSettings } from './infrastructure/better-auth/auth-settings';
import { authenticationApiFrom } from './infrastructure/better-auth/better-auth-authentication-api';
import { BetterAuthAuthenticator } from './infrastructure/better-auth/better-auth-authenticator';
import { BetterAuthCurrentActorProvider } from './infrastructure/better-auth/better-auth-current-actor-provider';
import { BetterAuthProfileAccount } from './infrastructure/better-auth/better-auth-profile-account';
import { sessionSourceFrom } from './infrastructure/better-auth/better-auth-session-source';
import { createAuth } from './infrastructure/better-auth/create-auth';
import { createAuthRouteHandlers } from './infrastructure/better-auth/create-auth-route-handlers';
import {
  memoizePerRequest,
  requestScoped,
} from './infrastructure/better-auth/current-actor-request-scope';
import { Sha256TokenGenerator } from './infrastructure/crypto/sha256-token-generator';
import { DevCurrentActorProvider } from './infrastructure/dev/dev-current-actor-provider';
import { TransactionalAuthMailer } from './infrastructure/mail/transactional-auth-mailer';
import { UnconfiguredAuthMailer } from './infrastructure/mail/unconfigured-auth-mailer';
import { getAuthPool } from './infrastructure/pg/auth-pool';
import { PgUserDirectory } from './infrastructure/pg/pg-user-directory';
import { PrismaInvitationRepository } from './infrastructure/prisma/prisma-invitation.repository';
import { PrismaMembershipRepository } from './infrastructure/prisma/prisma-membership.repository';
import { PrismaTenantRepository } from './infrastructure/prisma/prisma-tenant.repository';
import { StoredProfileImages } from './infrastructure/storage/stored-profile-images';
import { authRoutes } from './presentation/routes';

import type {
  AuthenticationDependencies,
  UserAdministrationDependencies,
} from './application/auth-dependencies';
import type { AuthorizationService } from './application/authorization-service';
import type { ProfileDependencies } from './application/profile-dependencies';
import type { Permission } from './domain/models/permission';
import type { AuthMailer } from './domain/ports/auth-mailer.port';
import type { CurrentActorProvider } from './domain/ports/current-actor-provider.port';
import type { MembershipRepository } from './domain/ports/membership.repository';
import type { BetterAuthInstance } from './infrastructure/better-auth/create-auth';

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

/**
 * The website a request is about, as `proxy.ts` set it from the address. Members select it only
 * when they belong to it; platform administrators and the loopback-only dev actor may select any website. This is the one place
 * the header is read, and it is checked here against the shape of a website id, as well as by the
 * proxy that wrote it: the reader does not trust the writer.
 */
async function readTenantHint(): Promise<string | null> {
  const raw = (await headers()).get(TENANT_HINT_HEADER);
  return raw !== null && isWebsiteId(raw) ? raw : null;
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
    connectionTimeoutMs: serverEnv.DATABASE_POOL_TIMEOUT_SECONDS * MS_PER_SECOND,
    statementTimeoutMs: serverEnv.DATABASE_STATEMENT_TIMEOUT_SECONDS * MS_PER_SECOND,
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

function buildCurrentActorProvider(): CurrentActorProvider {
  return serverEnv.AUTH_ENABLED
    ? new BetterAuthCurrentActorProvider({
        sessions: sessionSourceFrom(getAuth),
        memberships: getMemberships(),
        getHeaders: () => headers(),
        sessionMaxLifetimeMs: serverEnv.AUTH_SESSION_MAX_LIFETIME_SECONDS * MS_PER_SECOND,
        clock: systemClock,
        platformAdminEmails: new Set(serverEnv.AUTH_PLATFORM_ADMIN_EMAILS),
        getTenantHint: readTenantHint,
      })
    : requestScoped(
        () =>
          new DevCurrentActorProvider({
            role: serverEnv.AUTH_DEV_ACTOR_ROLE,
            getTenantHint: readTenantHint,
            nodeEnv: serverEnv.NODE_ENV,
            appUrl: publicEnv.NEXT_PUBLIC_APP_URL,
          }),
      );
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

/** The disabled account adapter also refuses direct action calls when real authentication is off. */
const getProfileDependencies = once<ProfileDependencies>(() => ({
  authorization: getAccessControl(),
  account: serverEnv.AUTH_ENABLED
    ? new BetterAuthProfileAccount({ getApi: () => getAuth().api, getHeaders: () => headers() })
    : { read: () => errAsync(unauthenticated()), update: () => errAsync(unauthenticated()) },
  images: new StoredProfileImages({ getStore: getObjectStore, newId: randomUUID }),
  rateLimiter: getRateLimiter(),
  audit: auditLog,
}));

export const getProfileCommands = once(() => ({
  updateOwnProfile: new UpdateOwnProfile(getProfileDependencies()),
}));

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
 * Everything user administration is built from. The user directory opens the
 * auth pool only when it is first asked, so building this needs no auth
 * configuration (the screens answer 404 while AUTH_ENABLED=false).
 */
const getAdministrationDependencies = once(
  () =>
    ({
      bootstrapAdminEmails: new Set(serverEnv.AUTH_PLATFORM_ADMIN_EMAILS),
      authorization: getAccessControl(),
      members: getMemberships(),
      directory: new PgUserDirectory(getPool),
      invitations: new PrismaInvitationRepository(),
      tokens: new Sha256TokenGenerator(),
      mailer: getMailer(),
      audit: auditLog,
      clock: systemClock,
      tenants: new PrismaTenantRepository(),
    }) satisfies UserAdministrationDependencies,
);

/** Shared lazy dependencies, with identity resolved afresh through the request-scoped provider. */
export const getAuthQueries = once(() => {
  const currentActor = getCurrentActorProvider();
  const administration = getAdministrationDependencies();
  return {
    getCurrentActor: new GetCurrentActor({ currentActor }),
    getOwnProfile: new GetOwnProfile(getProfileDependencies()),
    listUsers: new ListUsers(administration),
    resolveMemberNames: new ResolveMemberNames(administration),
    listEmployees: new ListEmployees(administration),
    listInvitations: new ListInvitations(administration),
    getMemberSummary: new GetMemberSummary(administration),
    previewInvitation: new PreviewInvitation({
      ...administration,
      currentActor,
    }),
    listPlatformUsers: new ListPlatformUsers(administration),
    listManageableWebsites: new ListManageableWebsites(administration),
    listAccessibleWebsites: new ListAccessibleWebsites(administration),
    authorizeWebsiteAccess: new AuthorizeWebsiteAccess(administration),
  } as const;
});

/**
 * Access adapter wired to the auth module's queries.
 * Supplies the audit module's access port and member name resolver without the audit module
 * needing a compile-time dependency on auth. Registration constructs no queries and reads no
 * session. The adapter delegates every permission decision to auth; audit owns trail scoping.
 */
setAuditAccessAdapter(new AuthAuditAccess(getAuthQueries), (memberIds) =>
  getAuthQueries().resolveMemberNames.execute(memberIds),
);

/**
 * Sign-in, sign-up, sign-out and password reset. Only meaningful while
 * AUTH_ENABLED=true; the pages that host them answer 404 otherwise, and
 * calling this with auth disabled is a programmer error that throws.
 */
const getAuthenticationDependencies = once((): AuthenticationDependencies => ({
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
}));

export const getAuthCommands = once(() => {
  const dependencies = getAuthenticationDependencies();
  const administration = getAdministrationDependencies();

  return {
    signIn: new SignIn(dependencies),
    admitLinkRequest: new AdmitLinkRequest(dependencies),
    signOut: new SignOut(dependencies),
    requestPasswordReset: new RequestPasswordReset(dependencies),
    resetPassword: new ResetPassword(dependencies),
    inviteUser: new InviteUser({ ...administration, rateLimiter: getRateLimiter() }),
    setUserAccess: new SetUserAccess(administration),
    removeUserAccess: new RemoveUserAccess(administration),
    grantPlatformAdmin: new GrantPlatformAdmin(administration),
    revokePlatformAdmin: new RevokePlatformAdmin(administration),
    revokeInvitation: new RevokeInvitation(administration),
    acceptInvitation: new AcceptInvitation({
      ...dependencies,
      ...administration,
      currentActor: getCurrentActorProvider(),
      bootstrapAdminEmails: administration.bootstrapAdminEmails,
    }),
  } as const;
});

/** For `app/api/auth/[...all]/route.ts`: the emailed links are the HTTP consumer. */
export const authRouteHandlers = createAuthRouteHandlers({
  isEnabled: serverEnv.AUTH_ENABLED,
  getAuth,
  admit: () => getAuthCommands().admitLinkRequest.execute(),
});

/** The language of the first mail, before anyone has chosen one: the platform's default locale. */
const BOOTSTRAP_MAIL_LOCALE: Locale = 'de';

/**
 * Work the server does once when it starts. With sign-up closed, the
 * platform administrators named in `AUTH_PLATFORM_ADMIN_EMAILS` have no way
 * to open an account, so each of them that has none is mailed a link to
 * create one (`InviteBootstrapAdmins`). Needs authentication and a mail
 * provider; without either it says so in the log and does nothing. A failure
 * is logged, never thrown: the application must start with or without it.
 */
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
    logger.error('auth.bootstrap_failed', error);
  }
}
