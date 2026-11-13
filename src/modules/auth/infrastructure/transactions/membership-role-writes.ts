import { advisoryLock, db, retryTransient } from '@lib/db';
import type { Transaction } from '@lib/db';

import { actorHasPermission } from '../../domain/models/authorize';
import { PLATFORM_ADMIN_ROLE, ROLES, isRole, rolesWithPermission } from '../../domain/models/role';
import { PLATFORM_TENANT_ID } from '../../domain/models/tenant';

import {
  invalidateInvitationsIssuedBy,
  invalidatePendingInvitations,
} from './invalidate-pending-invitations';

import type { Actor } from '../../domain/models/actor';
import type { ActorId, TenantId } from '../../domain/models/ids';
import type { Role, TenantRole } from '../../domain/models/role';
import type {
  MembershipRepository,
  MembershipWriteOptions,
} from '../../domain/ports/membership.repository';

const ADMINISTRATOR: TenantRole = 'admin';
const MANAGEMENT_ROLES = rolesWithPermission('user.manage');

/** Every known role, plus headroom for stored rows whose role this code does not know. */
const MAX_ROLE_ROWS = ROLES.length * 2;

/** Every grant, role replacement and removal shares this lock, so their effects cannot interleave. */
export async function lockTenantRoster(tx: Transaction, tenantId: TenantId): Promise<void> {
  await advisoryLock(tx, `membership:${tenantId}`);
}

/**
 * Locks the website row so its deletion cannot orphan a membership before this transaction commits.
 * False: the website is gone and the caller changes nothing. The platform scope has no website row.
 */
export async function lockWebsite(tx: Transaction, tenantId: TenantId): Promise<boolean> {
  const plan = db.raw.sql`SELECT "id" FROM "Website" WHERE "id" = ${tenantId} FOR KEY SHARE`
    .returnsRow({ id: { codecId: 'pg/text@1', nullable: false } })
    .build();
  const rows = await tx.query(plan);
  return rows.length === 1;
}

/** Whether the person holds the platform administrator role by membership (the bootstrap list is not a membership). */
export async function isPlatformAdminMember(tx: Transaction, actorId: ActorId): Promise<boolean> {
  const held = await tx.orm.public.Membership.where({
    actorId,
    tenantId: PLATFORM_TENANT_ID,
    role: PLATFORM_ADMIN_ROLE,
  })
    .select('actorId')
    .first();
  return held !== null;
}

/** Whether the person holds, in this tenant, a role that may manage its users. */
export async function managesUsersIn(
  tx: Transaction,
  actorId: ActorId,
  tenantId: TenantId,
): Promise<boolean> {
  const held = await tx.orm.public.Membership.where({ actorId, tenantId })
    .where((membership) => membership.role.in([...MANAGEMENT_ROLES]))
    .select('actorId')
    .first();
  return held !== null;
}

/** Adds one role of one person in one scope. Idempotent: an existing row is left alone. */
export async function addMembership(
  tx: Transaction,
  membership: { readonly actorId: ActorId; readonly tenantId: TenantId; readonly role: Role },
): Promise<void> {
  await tx.orm.public.Membership.select('role').upsert({
    create: membership,
    update: {},
    conflictOn: membership,
  });
}

/** In-memory counterpart of `managesUsersIn`, for role sets already read. */
function holdsManagement(roles: readonly string[]): boolean {
  return roles.some((role) => isRole(role) && MANAGEMENT_ROLES.includes(role));
}

/** A person who no longer manages users in this tenant (and has no platform membership) cannot leave offers behind. */
async function revokeLostInviterAuthority(
  tx: Transaction,
  input: {
    readonly actorId: ActorId;
    readonly tenantId: TenantId;
    readonly held: readonly string[];
    readonly wanted: readonly string[];
  },
): Promise<void> {
  const lostManagement = holdsManagement(input.held) && !holdsManagement(input.wanted);
  if (lostManagement && !(await isPlatformAdminMember(tx, input.actorId))) {
    await invalidateInvitationsIssuedBy(tx, { tenantId: input.tenantId, invitedBy: input.actorId });
  }
}

/** Makes the role set exact inside the transaction; failures roll back every added or removed role. */
async function writeRoles(
  tx: Transaction,
  { actorId, tenantId }: { readonly actorId: ActorId; readonly tenantId: TenantId },
  input: {
    readonly held: ReadonlyArray<{ readonly id: string; readonly role: string }>;
    readonly roles: readonly TenantRole[];
  },
): Promise<void> {
  const { held, roles } = input;
  for (const role of roles) {
    await addMembership(tx, { actorId, tenantId, role });
  }
  const wanted: readonly string[] = roles;
  for (const { id, role } of held) {
    if (!wanted.includes(role)) {
      // Delete by stored identity so obsolete role values need no coercion into the generated enum.
      await tx.orm.public.Membership.where({ id, actorId, tenantId }).deleteAndCount();
    }
  }
}

function matchesBaseline(
  held: readonly string[],
  expected: readonly TenantRole[] | undefined,
): boolean {
  if (expected === undefined) {
    return true;
  }
  const expectedRoles: readonly string[] = expected;
  // Editors see known tenant roles only. Legacy or newer-deploy rows must not make every baseline stale.
  const knownRoles = held.filter(isRole);
  return (
    knownRoles.length === expected.length &&
    knownRoles.every((role) => expectedRoles.includes(role))
  );
}

async function keepsAdministrator(
  tx: Transaction,
  input: {
    readonly tenantId: TenantId;
    readonly held: readonly string[];
    readonly wanted: readonly TenantRole[];
  },
): Promise<boolean> {
  if (!input.held.includes(ADMINISTRATOR) || input.wanted.includes(ADMINISTRATOR)) {
    return true;
  }
  const administrators = await tx.orm.public.Membership.where({
    tenantId: input.tenantId,
    role: ADMINISTRATOR,
  }).aggregate((aggregate) => ({ total: aggregate.count() }));
  return administrators.total > 1;
}

/** Recheck authority inside the same locks as membership writes to reject queued revoked managers. */
async function mayWriteMembership(
  tx: Transaction,
  tenantId: TenantId,
  actor: Actor,
): Promise<boolean> {
  if (actor.platformAuthority === 'bootstrap') {
    return true;
  }
  if (actorHasPermission(actor, 'platform.admin.manage')) {
    return isPlatformAdminMember(tx, actor.id);
  }
  return managesUsersIn(tx, actor.id, tenantId);
}

/** Atomic additive grants preserve existing roles, including concurrent grants from other invitations. */
export function grantMembershipRole(
  actorId: ActorId,
  tenantId: TenantId,
  role: TenantRole,
): Promise<void> {
  return retryTransient(() =>
    db.transaction(async (tx) => {
      await lockTenantRoster(tx, tenantId);
      if (await lockWebsite(tx, tenantId)) {
        await addMembership(tx, { actorId, tenantId, role });
      }
    }),
  );
}

/** Last-administrator protection and the complete replacement commit together, serialized per tenant. */
export function replaceMembershipRoles(
  actorId: ActorId,
  tenantId: TenantId,
  options: MembershipWriteOptions & { readonly roles: readonly TenantRole[] },
): Promise<boolean | 'last_admin'> {
  const { actor } = options;
  return retryTransient(() =>
    db.transaction(async (tx) => {
      // Platform first, then website: invitation acceptance uses the same lock order.
      if (actor !== undefined) {
        await lockTenantRoster(tx, PLATFORM_TENANT_ID);
      }
      await lockTenantRoster(tx, tenantId);
      if (!(await lockWebsite(tx, tenantId))) {
        return false;
      }
      if (actor !== undefined && !(await mayWriteMembership(tx, tenantId, actor))) {
        return false;
      }
      const heldRows = await tx.orm.public.Membership.where({ actorId, tenantId })
        .select('id', 'role')
        .limit(MAX_ROLE_ROWS)
        .all();
      const held = heldRows.map((record) => record.role);
      if (!matchesBaseline(held, options.expectedRoles)) {
        return false;
      }
      if (!(await keepsAdministrator(tx, { tenantId, held, wanted: options.roles }))) {
        return 'last_admin' as const;
      }
      await writeRoles(tx, { actorId, tenantId }, { held: heldRows, roles: options.roles });
      await invalidatePendingInvitations(tx, { tenantId, email: options.subjectEmail });
      await revokeLostInviterAuthority(tx, { actorId, tenantId, held, wanted: options.roles });
      return true;
    }),
  );
}

/** Platform changes share one scope lock, including grants made through bootstrap invitations. */
export function grantPlatformMembership(
  actorId: ActorId,
  options?: MembershipWriteOptions,
): Promise<boolean> {
  return retryTransient(() =>
    db.transaction(async (tx) => {
      await lockTenantRoster(tx, PLATFORM_TENANT_ID);
      if (
        options?.actor !== undefined &&
        !(await mayWriteMembership(tx, PLATFORM_TENANT_ID, options.actor))
      ) {
        return false;
      }
      await addMembership(tx, {
        actorId,
        tenantId: PLATFORM_TENANT_ID,
        role: PLATFORM_ADMIN_ROLE,
      });
      await invalidatePendingInvitations(tx, {
        tenantId: PLATFORM_TENANT_ID,
        email: options?.subjectEmail,
      });
      return true;
    }),
  );
}

/** A revoked membership actor cannot complete a queued permission mutation using stale authority. */
export function revokePlatformMembership(
  subjectId: ActorId,
  actor: Parameters<MembershipRepository['revokePlatformAdmin']>[1],
): Promise<boolean> {
  return retryTransient(() =>
    db.transaction(async (tx) => {
      await lockTenantRoster(tx, PLATFORM_TENANT_ID);
      // Bootstrap authority comes from configuration; a membership's must still exist under the lock.
      if (actor.authority === 'membership' && !(await isPlatformAdminMember(tx, actor.actorId))) {
        return false;
      }
      const removed = await tx.orm.public.Membership.where({
        actorId: subjectId,
        tenantId: PLATFORM_TENANT_ID,
        role: PLATFORM_ADMIN_ROLE,
      }).deleteAndCount();
      await invalidatePendingInvitations(tx, {
        tenantId: PLATFORM_TENANT_ID,
        email: actor.subjectEmail,
      });
      if (removed > 0) {
        await invalidateInvitationsIssuedBy(tx, {
          tenantId: PLATFORM_TENANT_ID,
          invitedBy: subjectId,
        });
      }
      return true;
    }),
  );
}
