import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ActorId, TenantId } from '../models/ids';
import type { Role } from '../models/role';

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
  ): AppResultAsync<readonly Role[], InfrastructureAppError>;

  /**
   * Every member of the tenant with their roles, optionally only those
   * holding `role`. Bounded by `MAX_TENANT_MEMBERS`: a tenant larger than
   * that is reported through `isTruncated` instead of read without limit.
   */
  listMembers(
    tenantId: TenantId,
    filter: { readonly role: Role | null },
  ): AppResultAsync<MemberRoster, InfrastructureAppError>;

  /**
   * Makes `roles` the member's complete set in the tenant. Roles are added
   * before the others are removed, so a failure part-way never leaves a
   * member with none.
   */
  replaceRoles(
    actorId: ActorId,
    tenantId: TenantId,
    roles: readonly Role[],
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
    roles: readonly Role[],
  ): AppResultAsync<boolean, InfrastructureAppError>;

  /** Removing a member is `replaceRolesKeepingAdministrator` with no roles; `false` has the same meaning. */
  removeMemberKeepingAdministrator(
    actorId: ActorId,
    tenantId: TenantId,
  ): AppResultAsync<boolean, InfrastructureAppError>;
}

/** The members of a tenant: actor id to roles, in a stable order. */
export interface MemberRoster {
  readonly members: ReadonlyMap<ActorId, readonly Role[]>;
  readonly isTruncated: boolean;
}

/** Most members of one tenant the roster reads (see `listMembers`). */
export const MAX_TENANT_MEMBERS = 2_000;
