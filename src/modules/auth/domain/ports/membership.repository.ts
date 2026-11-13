import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { Actor } from '../models/actor';
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

  /** Platform administrators by membership, oldest first, at most `limit`; `isTruncated` says there are more. */
  listPlatformAdmins(
    limit: number,
  ): AppResultAsync<
    { readonly ids: readonly ActorId[]; readonly isTruncated: boolean },
    InfrastructureAppError
  >;

  /** Makes the person a platform administrator. Idempotent and serialized with revocations. */
  grantPlatformAdmin(
    actorId: ActorId,
    options?: MembershipWriteOptions,
  ): AppResultAsync<boolean, InfrastructureAppError>;

  /**
   * Revokes a platform membership only while the initiating actor still has platform authority.
   * The authority comes from the trusted actor provider, never request input. A membership actor
   * is rechecked inside the same lock as deletion; bootstrap authority is configured independently.
   * `false` means the actor lost authority and nothing was changed.
   */
  revokePlatformAdmin(
    subjectId: ActorId,
    actor: {
      readonly actorId: ActorId;
      readonly authority: NonNullable<Actor['platformAuthority']>;
      readonly subjectEmail?: string;
    },
  ): AppResultAsync<boolean, InfrastructureAppError>;

  /** The oldest website membership used when no eligible website hint is selected; no full roster is loaded. */
  findFirstTenant(actorId: ActorId): AppResultAsync<TenantId | null, InfrastructureAppError>;

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
    filter: {
      readonly tenantId: TenantId | null;
      readonly role: TenantRole | null;
      readonly tenantIds?: readonly TenantId[];
    },
    limit: number,
  ): AppResultAsync<
    { readonly ids: readonly ActorId[]; readonly isTruncated: boolean },
    InfrastructureAppError
  >;
  /**
   * The websites where the person holds at least one of `roles`, oldest membership first, at most `limit`;
   * `isTruncated` says there are more. The platform scope is not a tenant here. Bound to the person's own id.
   */
  findTenantIdsWithRoles(
    actorId: ActorId,
    roles: readonly TenantRole[],
    limit: number,
  ): AppResultAsync<
    { readonly tenantIds: readonly TenantId[]; readonly isTruncated: boolean },
    InfrastructureAppError
  >;
  /**
   * Where each of these people holds roles, in one read for all of them: the
   * tenants, oldest membership first, with their roles. People without a
   * membership are absent. The platform scope is not a tenant here. Exceeding the read budget fails
   * explicitly rather than presenting an incomplete access list.
   */
  listMembershipsOf(
    actorIds: readonly ActorId[],
    tenantIds?: readonly TenantId[],
  ): AppResultAsync<ReadonlyMap<ActorId, readonly TenantMembership[]>, InfrastructureAppError>;
  /** How many people hold a role in the tenant, and how many hold each role (a person may hold several). */
  countMembers(tenantId: TenantId): AppResultAsync<MemberCounts, InfrastructureAppError>;

  /** Atomically adds one role without replacing any role already held. Idempotent and serialized with replacements. */
  grantRole(
    actorId: ActorId,
    tenantId: TenantId,
    role: TenantRole,
  ): AppResultAsync<void, InfrastructureAppError>;

  /**
   * Atomically makes `roles` the member's complete set, adding the member if absent.
   * The count of administrators and the write happen in one transaction that
   * is serialized per tenant, so two concurrent changes cannot each see "one
   * more administrator remains". Last-administrator protection returns a typed conflict.
   * `false` means the website, authorization, or observed role baseline changed; nothing was written.
   */
  replaceRolesKeepingAdministrator(
    actorId: ActorId,
    tenantId: TenantId,
    input: MembershipWriteOptions & { readonly roles: readonly TenantRole[] },
  ): AppResultAsync<boolean, InfrastructureAppError | ConflictAppError>;

  /** Removing a member is `replaceRolesKeepingAdministrator` with no roles and the same refusal outcomes. */
  removeMemberKeepingAdministrator(
    actorId: ActorId,
    tenantId: TenantId,
    options?: MembershipWriteOptions,
  ): AppResultAsync<boolean, InfrastructureAppError | ConflictAppError>;
}

/** Trusted actor and optional observed role baseline are checked while holding the write lock. */
export interface MembershipWriteOptions {
  readonly actor?: Actor;
  readonly expectedRoles?: readonly TenantRole[];
  /** Resolved from the target account, never accepted from a mutation request. */
  readonly subjectEmail?: string;
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
