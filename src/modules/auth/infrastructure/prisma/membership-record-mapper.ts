import { ROLES, isRole } from '../../domain/models/role';

import type { Role } from '../../domain/models/role';

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
export function toRoles(records: readonly MembershipRecord[]): readonly Role[] {
  return records.map((record) => record.role).filter(isRole);
}
