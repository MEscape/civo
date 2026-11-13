import { unique } from '@lib/utils';

import { toActorId, toTenantId } from '../../domain/models/ids';
import { ROLES, isRole } from '../../domain/models/role';
import { PLATFORM_TENANT_ID } from '../../domain/models/tenant';
import { MAX_TENANT_MEMBERS } from '../../domain/ports/membership.repository';

import type { ActorId, TenantId } from '../../domain/models/ids';
import type { TenantRole } from '../../domain/models/role';
import type { MemberRoster, TenantMembership } from '../../domain/ports/membership.repository';

/**
 * Persistence shape.
 *
 * Generated Prisma contract types never leave the persistence layer.
 */
export interface MembershipRecord {
  readonly role: string;
}

/**
 * Field list for `.select(...)`; `satisfies` keeps it in sync with the
 * record shape. See `website-record-mapper.ts` for why Prisma 8 spreads it.
 */
export const MEMBERSHIP_SELECT = ['role'] as const satisfies ReadonlyArray<keyof MembershipRecord>;

/**
 * One row per (actor, tenant, role) and a unique constraint on that triple,
 * so an actor can never hold more rows than there are roles. That bound is
 * also the query's `limit` (performance.md: every list is bounded).
 */
export const MAX_MEMBERSHIP_ROWS = ROLES.length;

/**
 * Fail closed on unrecognized data. A stored role this code does not know
 * (a typo, a role added by a newer deploy, a corrupted row) is discarded,
 * never granted. Discarding can only remove access, so bad data cannot
 * escalate privilege.
 */
export function toRoles(records: readonly MembershipRecord[]): readonly TenantRole[] {
  return records.map((record) => record.role).filter(isRole);
}

/** One stored role of one person in one tenant, as a roster is read. */
interface RosterRecord {
  readonly actorId: string;
  readonly role: string;
}

function pushTo<K, V>(groups: Map<K, V[]>, key: K, value: V): void {
  const group = groups.get(key);
  if (group === undefined) {
    groups.set(key, [value]);
  } else {
    group.push(value);
  }
}

/**
 * The people of a page, each with the roles held per tenant. The platform scope
 * is not a tenant and is left out; a role this code does not know is discarded,
 * like in `toRoles`.
 */
export function toMembershipsByActor(
  records: ReadonlyArray<RosterRecord & { readonly tenantId: string }>,
): ReadonlyMap<ActorId, readonly TenantMembership[]> {
  const byActor = new Map<ActorId, Map<TenantId, TenantRole[]>>();
  for (const record of records) {
    if (!isRole(record.role) || record.tenantId === PLATFORM_TENANT_ID) {
      continue;
    }
    const actorId = toActorId(record.actorId);
    const tenants = byActor.get(actorId) ?? new Map<TenantId, TenantRole[]>();
    byActor.set(actorId, tenants);
    pushTo(tenants, toTenantId(record.tenantId), record.role);
  }
  return new Map(
    [...byActor].map(([actorId, tenants]) => [
      actorId,
      [...tenants].map(([tenantId, roles]): TenantMembership => ({ tenantId, roles })),
    ]),
  );
}

/**
 * The members of one tenant with all their roles. Unknown roles are discarded. The bound on how many
 * people are read belongs to the repository, which selects the people first; it passes `isTruncated`.
 */
export function toMemberRoster(
  records: readonly RosterRecord[],
  isTruncated?: boolean,
): MemberRoster {
  const members = new Map<ActorId, TenantRole[]>();
  let hasMoreThanLimit = false;
  for (const record of records) {
    if (isRole(record.role)) {
      const actorId = toActorId(record.actorId);
      if (!members.has(actorId) && members.size >= MAX_TENANT_MEMBERS) {
        hasMoreThanLimit = true;
        continue;
      }
      pushTo(members, actorId, record.role);
    }
  }
  return { members, isTruncated: isTruncated ?? hasMoreThanLimit };
}

/** The websites among the rows, once each, at most `limit`; more rows or websites than that are reported, not cut silently. */
export function toManagedTenants(
  records: ReadonlyArray<{ readonly tenantId: string }>,
  limit: number,
  rowLimit: number,
): { readonly tenantIds: readonly TenantId[]; readonly isTruncated: boolean } {
  const tenants = unique(records.map((record) => record.tenantId));
  return {
    tenantIds: tenants.slice(0, limit).map(toTenantId),
    isTruncated: records.length > rowLimit || tenants.length > limit,
  };
}
