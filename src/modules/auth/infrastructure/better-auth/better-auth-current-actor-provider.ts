import type { Clock } from '@lib/clock';
import { matchAppError } from '@lib/errors';
import type { AppError } from '@lib/errors';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  sessionExpired,
  sessionLookupFailed,
  unauthenticated,
} from '../../domain/errors/auth-errors';
import { normalizeEmail } from '../../domain/models/credentials';
import { toActorId } from '../../domain/models/ids';
import { isRole, PLATFORM_ADMIN_ROLE } from '../../domain/models/role';
import { hasExceededMaxLifetime } from '../../domain/models/session-policy';
import {
  PLATFORM_TENANT_ID,
  UNASSIGNED_TENANT_ID,
  readTenantHint,
} from '../../domain/models/tenant';

import { mapBetterAuthError } from './map-better-auth-error';

import type { SessionSnapshot, SessionSource } from './better-auth-session-source';
import type { Actor } from '../../domain/models/actor';
import type { ActorId, TenantId } from '../../domain/models/ids';
import type { TenantRole } from '../../domain/models/role';
import type {
  CurrentActorError,
  CurrentActorProvider,
} from '../../domain/ports/current-actor-provider.port';
import type { MembershipRepository } from '../../domain/ports/membership.repository';

export interface BetterAuthCurrentActorProviderDeps {
  readonly sessions: SessionSource;
  readonly memberships: MembershipRepository;
  /** Supplies the incoming request headers. Injected because `next/headers` is a framework import. */
  readonly getHeaders: () => Promise<Headers>;
  readonly sessionMaxLifetimeMs: number;
  readonly clock: Clock;
  /**
   * Addresses that are platform administrators whatever the memberships say
   * (lower case). The bootstrap of a deployment: the first administrator
   * has to come from somewhere. Only a verified address counts.
   */
  readonly platformAdminEmails: ReadonlySet<string>;
  /**
   * The website the request is about (`x-civo-tenant`, set by the proxy from the
   * address). Platform administrators may work in any tenant; members select
   * it only when they hold roles there, otherwise their oldest membership is used.
   */
  readonly getTenantHint: () => Promise<string | null>;
}

export class BetterAuthCurrentActorProvider implements CurrentActorProvider {
  constructor(private readonly deps: BetterAuthCurrentActorProviderDeps) {}

  getCurrentActor(): AppResultAsync<Actor, CurrentActorError> {
    // `fromThrowableAsync` also catches a synchronous throw from `getHeaders`.
    return fromThrowableAsync(
      async () =>
        this.deps.sessions.getSession({
          headers: await this.deps.getHeaders(),
        }),
      (thrown) => narrowSessionLookupError(mapBetterAuthError(thrown, sessionLookupFailed)),
    ).andThen((session) => this.resolveActor(session));
  }

  private resolveActor(session: SessionSnapshot | null): AppResultAsync<Actor, CurrentActorError> {
    // No session is the normal "not signed in" outcome, not a failure of the provider.
    if (session === null) {
      return errAsync(unauthenticated());
    }

    const isTooOld = hasExceededMaxLifetime(
      session.session.createdAt,
      this.deps.clock.now(),
      this.deps.sessionMaxLifetimeMs,
    );
    if (isTooOld) {
      return errAsync(sessionExpired());
    }

    const actorId = toActorId(session.user.id);
    const isBootstrapAdmin =
      session.user.emailVerified &&
      this.deps.platformAdminEmails.has(normalizeEmail(session.user.email));
    if (isBootstrapAdmin) {
      return this.resolvePlatformAdmin(actorId, 'bootstrap');
    }
    return this.deps.memberships
      .isPlatformAdmin(actorId)
      .andThen((isPlatformAdmin) =>
        isPlatformAdmin
          ? this.resolvePlatformAdmin(actorId, 'membership')
          : this.resolveMember(actorId),
      );
  }

  /** A platform administrator stands in the website the request names, or in no tenant at all. */
  private resolvePlatformAdmin(
    actorId: ActorId,
    platformAuthority: NonNullable<Actor['platformAuthority']>,
  ): AppResultAsync<Actor, CurrentActorError> {
    return readTenantHint(this.deps.getTenantHint).map((hint) => ({
      id: actorId,
      tenantId: hint ?? PLATFORM_TENANT_ID,
      roles: [PLATFORM_ADMIN_ROLE],
      platformAuthority,
    }));
  }

  /**
   * Everyone else is resolved from their memberships alone: the tenant they
   * belong to (the one the request names when they belong to several), and
   * their roles in it. No membership is a valid state: the actor is
   * authenticated but holds nothing anywhere, so authorization denies every
   * permission. It must not be an error here.
   */
  private resolveMember(actorId: ActorId): AppResultAsync<Actor, CurrentActorError> {
    return readTenantHint(this.deps.getTenantHint).andThen((hint) => {
      if (hint === null) {
        return this.resolveFirstMembership(actorId);
      }
      return this.tenantRolesOf(actorId, hint).andThen((roles) =>
        roles.length === 0
          ? this.resolveFirstMembership(actorId)
          : okAsync({ id: actorId, tenantId: hint, roles }),
      );
    });
  }

  /** Login needs the selected membership, not a capped enumeration of every website a person can access. */
  private resolveFirstMembership(actorId: ActorId): AppResultAsync<Actor, CurrentActorError> {
    return this.deps.memberships.findFirstTenant(actorId).andThen((tenantId) =>
      tenantId === null
        ? okAsync({ id: actorId, tenantId: UNASSIGNED_TENANT_ID, roles: [] })
        : this.tenantRolesOf(actorId, tenantId).map((roles) => ({
            id: actorId,
            tenantId,
            roles,
          })),
    );
  }

  /**
   * The roles held inside a tenant. The platform role is never a tenant role: a membership row that
   * names it here is discarded, whatever the repository returned.
   */
  private tenantRolesOf(
    actorId: ActorId,
    tenantId: TenantId,
  ): AppResultAsync<readonly TenantRole[], CurrentActorError> {
    return this.deps.memberships.findRoles(actorId, tenantId).map((held) => held.filter(isRole));
  }
}

/**
 * The port only allows unauthorized or infrastructure failures from a
 * session lookup. `mapBetterAuthError` can produce other kinds (a conflict
 * or validation error is meaningless for reading a session), and returning
 * one would break the port's contract. Anything outside the contract is
 * collapsed to an infrastructure error, which fails closed. The exhaustive
 * match forces a decision if `AppError` ever gains a kind.
 */
function narrowSessionLookupError(error: AppError): CurrentActorError {
  return matchAppError<CurrentActorError>(error, {
    unauthorized: (allowed) => allowed,
    infrastructure: (allowed) => allowed,
    validation: sessionLookupFailed,
    not_found: sessionLookupFailed,
    conflict: sessionLookupFailed,
    rate_limited: sessionLookupFailed,
    forbidden: sessionLookupFailed,
    unexpected: sessionLookupFailed,
  });
}
