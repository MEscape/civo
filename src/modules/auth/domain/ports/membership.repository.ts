import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ActorId, TenantId } from '../models/ids';
import type { TenantRole } from '../models/role';

/**
 * The application's own record of who holds which roles in which tenant.
 * This, not the authentication provider, is the source of truth for
 * authorization: the provider only proves who someone is.
 *
 * Returns an empty list (not an error) when the actor has no membership in
 * the tenant. "No roles" is a normal outcome that authorization then
 * denies, which keeps the fail-closed path in one place. Roles the code
 * does not know are discarded by the adapter, never granted.
 */
export interface MembershipRepository {
  findRoles(
    actorId: ActorId,
    tenantId: TenantId,
  ): AppResultAsync<readonly TenantRole[], InfrastructureAppError>;

  /**
   * Whether the person is a platform administrator by membership: a row in
   * the reserved platform scope. (The deployment's bootstrap list of
   * addresses is a second way, decided by the actor provider.)
   */
  isPlatformAdmin(actorId: ActorId): AppResultAsync<boolean, InfrastructureAppError>;

  /** Everyone who is a platform administrator by membership, oldest first. Bounded. */
  listPlatformAdmins(): AppResultAsync<readonly ActorId[], InfrastructureAppError>;

  /** Makes the person a platform administrator, or not. Idempotent. */
  setPlatformAdmin(
    actorId: ActorId,
    isAdministrator: boolean,
  ): AppResultAsync<void, InfrastructureAppError>;

  /** The tenants the person holds a role in, oldest membership first. Bounded; the platform scope is not one. */
  findTenantsOf(actorId: ActorId): AppResultAsync<readonly TenantId[], InfrastructureAppError>;

  /**
   * Every member of the tenant with their roles, optionally only those
   * holding `role`. Bounded by `MAX_TENANT_MEMBERS`: a tenant larger than
   * that is reported through `isTruncated` instead of read without limit.
   */
  listMembers(
    tenantId: TenantId,
    filter: { readonly role: TenantRole | null },
  ): AppResultAsync<MemberRoster, InfrastructureAppError>;

  /**
   * The people holding a role in `tenantId` (any tenant: `null`) and, if given, `role`:
   * the ids a platform-wide listing narrows to. Bounded by `limit`; `isTruncated` says there are more.
   * The platform scope is not a tenant here.
   */
  findMemberIds(
    filter: { readonly tenantId: TenantId | null; readonly role: TenantRole | null },
    limit: number,
  ): AppResultAsync<
    { readonly ids: readonly ActorId[]; readonly isTruncated: boolean },
    InfrastructureAppError
  >;
  /**
   * Where each of these people holds roles, in one read for all of them: the
   * tenants, oldest membership first, with their roles. People without a
   * membership are absent. The platform scope is not a tenant here.
   */
  listMembershipsOf(
    actorIds: readonly ActorId[],
  ): AppResultAsync<ReadonlyMap<ActorId, readonly TenantMembership[]>, InfrastructureAppError>;
  /** How many people hold a role in the tenant, and how many hold each role (a person may hold several). */
  countMembers(tenantId: TenantId): AppResultAsync<MemberCounts, InfrastructureAppError>;

  /**
   * Makes `roles` the member's complete set in the tenant. Roles are added
   * before the others are removed, so a failure part-way never leaves a
   * member with none.
   */
  replaceRoles(
    actorId: ActorId,
    tenantId: TenantId,
    roles: readonly TenantRole[],
  ): AppResultAsync<void, InfrastructureAppError>;

  /**
   * `replaceRoles` for a change that may take the administrator role away.
   * The count of administrators and the write happen in one transaction that
   * is serialized per tenant, so two concurrent changes cannot each see "one
   * more administrator remains". `false`: refused, the member is the tenant's
   * last administrator and nothing was written.
   */
  replaceRolesKeepingAdministrator(
    actorId: ActorId,
    tenantId: TenantId,
    roles: readonly TenantRole[],
  ): AppResultAsync<boolean, InfrastructureAppError>;

  /** Removing a member is `replaceRolesKeepingAdministrator` with no roles; `false` has the same meaning. */
  removeMemberKeepingAdministrator(
    actorId: ActorId,
    tenantId: TenantId,
  ): AppResultAsync<boolean, InfrastructureAppError>;
}

/** One person's roles in one tenant. */
export interface TenantMembership {
  readonly tenantId: TenantId;
  readonly roles: readonly TenantRole[];
}

/** The members of a tenant: actor id to roles, in a stable order. */
export interface MemberRoster {
  readonly members: ReadonlyMap<ActorId, readonly TenantRole[]>;
  readonly isTruncated: boolean;
}

/** The size of a tenant's membership. Roles nobody holds are absent from `byRole`. */
export interface MemberCounts {
  readonly members: number;
  readonly byRole: ReadonlyMap<TenantRole, number>;
}

/** Most members of one tenant the roster reads (see `listMembers`). */
export const MAX_TENANT_MEMBERS = 2_000;
