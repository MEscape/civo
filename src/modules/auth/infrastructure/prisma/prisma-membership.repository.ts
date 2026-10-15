import { createPersistenceFailures, db } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { logger } from '@lib/logger';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { AUTH_ERROR_CODES } from '../../domain/errors/auth-errors';
import { toActorId, toTenantId } from '../../domain/models/ids';
import { PLATFORM_ADMIN_ROLE, ROLES, isRole } from '../../domain/models/role';
import { PLATFORM_TENANT_ID } from '../../domain/models/tenant';
import { MAX_TENANT_MEMBERS } from '../../domain/ports/membership.repository';

import { MAX_MEMBERSHIP_ROWS, MEMBERSHIP_SELECT, toRoles } from './membership-record-mapper';

import type { ActorId, TenantId } from '../../domain/models/ids';
import type { TenantRole } from '../../domain/models/role';
import type { MemberRoster, MembershipRepository } from '../../domain/ports/membership.repository';

const ADMINISTRATOR: TenantRole = 'admin';

const membershipLogger = logger.withContext({ module: 'auth.membership' });

const failures = createPersistenceFailures({
  module: 'auth.membership.persistence',
  code: AUTH_ERROR_CODES.membershipLookupFailed,
  subject: 'Membership',
});

/** The handle `db.transaction` passes to its callback. */
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Serializes every change to who administers one tenant. The lock is
 * released when the transaction ends.
 */
async function lockTenantRoster(tx: Transaction, tenantId: TenantId): Promise<void> {
  const key = `membership:${tenantId}`;
  const plan = db.raw.sql`SELECT pg_advisory_xact_lock(hashtext(${key}))::text AS locked`
    .returnsRow({ locked: { codecId: 'pg/text@1', nullable: true } })
    .build();
  await tx.query(plan);
}

/** Makes `roles` the member's complete set. Add first, remove second: a failure in between leaves too many roles, never none. */
async function writeRoles(
  source: Pick<Transaction, 'orm'>,
  { actorId, tenantId }: { readonly actorId: ActorId; readonly tenantId: TenantId },
  roles: readonly TenantRole[],
): Promise<void> {
  for (const role of roles) {
    await source.orm.public.Membership.select('role').upsert({
      create: { actorId, tenantId, role },
      update: {},
      conflictOn: { actorId, tenantId, role },
    });
  }
  const current = await source.orm.public.Membership.where({ actorId, tenantId })
    .select('role')
    .limit(ROLES.length * 2)
    .all();
  for (const record of current) {
    if (!roles.some((role) => role === record.role)) {
      await source.orm.public.Membership.where({
        actorId,
        tenantId,
        role: record.role,
      }).deleteAndCount();
    }
  }
}

/**
 * Prisma 8 repository for memberships: the application's own record of who
 * holds which roles in which tenant. This, not the authentication provider,
 * is the source of truth for authorization.
 *
 * - Query results are awaitable but not `Promise`s, so the thunk is `async`
 *   and returns the query directly: the async wrapper awaits it.
 * - Only `infraOnly` failures: a refusal to remove the last administrator is a
 *   value (`false`), not an error.
 *
 * `actorId` has no foreign key to Better Auth's user table: the two live in
 * different databases/roles by design. See migrations/app/0001_membership.sql.
 */
/** More platform administrators than this is a data error, not a case to serve. */
const MAX_PLATFORM_ADMINS = 100;

/** More tenants than this for one person is a data error, not a case to serve. */
const MAX_TENANTS_PER_ACTOR = 50;

export class PrismaMembershipRepository implements MembershipRepository {
  isPlatformAdmin(actorId: ActorId): AppResultAsync<boolean, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.Membership.where({
          actorId,
          tenantId: PLATFORM_TENANT_ID,
          role: PLATFORM_ADMIN_ROLE,
        })
          .select('role')
          .first(),
      failures.infraOnly('isPlatformAdmin'),
    ).map((record) => record !== null);
  }

  listPlatformAdmins(): AppResultAsync<readonly ActorId[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.Membership.where({
          tenantId: PLATFORM_TENANT_ID,
          role: PLATFORM_ADMIN_ROLE,
        })
          .select('actorId')
          .orderBy([
            (membership) => membership.createdAt.asc(),
            (membership) => membership.id.asc(),
          ])
          .limit(MAX_PLATFORM_ADMINS)
          .all(),
      failures.infraOnly('listPlatformAdmins'),
    ).map((records) => records.map((record) => toActorId(record.actorId)));
  }

  setPlatformAdmin(
    actorId: ActorId,
    isAdministrator: boolean,
  ): AppResultAsync<void, InfrastructureAppError> {
    const scope = { actorId, tenantId: PLATFORM_TENANT_ID, role: PLATFORM_ADMIN_ROLE };
    return fromThrowableAsync(async () => {
      if (isAdministrator) {
        await db.orm.public.Membership.select('role').upsert({
          create: scope,
          update: {},
          conflictOn: scope,
        });
      } else {
        await db.orm.public.Membership.where(scope).deleteAndCount();
      }
    }, failures.infraOnly('setPlatformAdmin'));
  }

  findTenantsOf(actorId: ActorId): AppResultAsync<readonly TenantId[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.Membership.where({ actorId })
          .select('tenantId')
          .orderBy([
            (membership) => membership.createdAt.asc(),
            (membership) => membership.id.asc(),
          ])
          .limit(MAX_TENANTS_PER_ACTOR * ROLES.length)
          .all(),
      failures.infraOnly('findTenantsOf'),
    ).map((records) => {
      const tenants = new Set<string>(records.map((record) => record.tenantId));
      tenants.delete(PLATFORM_TENANT_ID);
      return [...tenants].map(toTenantId);
    });
  }

  findRoles(
    actorId: ActorId,
    tenantId: TenantId,
  ): AppResultAsync<readonly TenantRole[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.Membership.where({ actorId, tenantId })
          .select(...MEMBERSHIP_SELECT)
          // Stable order, so the same actor always resolves to the same list.
          .orderBy([(membership) => membership.role.asc()])
          .limit(MAX_MEMBERSHIP_ROWS)
          .all(),
      failures.infraOnly('findRoles'),
    ).map((records) => {
      const roles = toRoles(records);
      if (roles.length !== records.length) {
        membershipLogger.warn('auth.membership_unknown_role_ignored', {
          ignoredCount: records.length - roles.length,
        });
      }
      return roles;
    });
  }

  listMembers(
    tenantId: TenantId,
    filter: { readonly role: TenantRole | null },
  ): AppResultAsync<MemberRoster, InfrastructureAppError> {
    // One row per (actor, role); a tenant of MAX_TENANT_MEMBERS people holds at most that times the number of roles.
    const rowLimit = MAX_TENANT_MEMBERS * ROLES.length + 1;
    return fromThrowableAsync(
      async () =>
        db.orm.public.Membership.where({ tenantId })
          .select('actorId', 'role')
          .orderBy([
            (membership) => membership.actorId.asc(),
            (membership) => membership.role.asc(),
          ])
          .limit(rowLimit)
          .all(),
      failures.infraOnly('listMembers'),
    ).map((records): MemberRoster => {
      const byActor = new Map<ActorId, TenantRole[]>();
      for (const record of records) {
        if (!isRole(record.role)) {
          continue;
        }
        const actorId = toActorId(record.actorId);
        byActor.set(actorId, [...(byActor.get(actorId) ?? []), record.role]);
      }
      const isTruncated = byActor.size > MAX_TENANT_MEMBERS || records.length === rowLimit;
      const members = new Map(
        [...byActor]
          .filter(([, roles]) => filter.role === null || roles.includes(filter.role))
          .slice(0, MAX_TENANT_MEMBERS),
      );
      return { members, isTruncated };
    });
  }

  replaceRoles(
    actorId: ActorId,
    tenantId: TenantId,
    roles: readonly TenantRole[],
  ): AppResultAsync<void, InfrastructureAppError> {
    return fromThrowableAsync(
      () => writeRoles(db, { actorId, tenantId }, roles),
      failures.infraOnly('replaceRoles'),
    );
  }

  replaceRolesKeepingAdministrator(
    actorId: ActorId,
    tenantId: TenantId,
    roles: readonly TenantRole[],
  ): AppResultAsync<boolean, InfrastructureAppError> {
    return fromThrowableAsync(
      () =>
        db.transaction(async (tx) => {
          await lockTenantRoster(tx, tenantId);
          const held = await tx.orm.public.Membership.where({ actorId, tenantId })
            .select('role')
            .limit(ROLES.length * 2)
            .all();
          const losesAdministrator =
            held.some((record) => record.role === ADMINISTRATOR) && !roles.includes(ADMINISTRATOR);
          if (losesAdministrator) {
            const administrators = await tx.orm.public.Membership.where({
              tenantId,
              role: ADMINISTRATOR,
            }).aggregate((aggregate) => ({ total: aggregate.count() }));
            if (administrators.total <= 1) {
              return false;
            }
          }
          await writeRoles(tx, { actorId, tenantId }, roles);
          return true;
        }),
      failures.infraOnly('replaceRolesKeepingAdministrator'),
    );
  }

  removeMemberKeepingAdministrator(
    actorId: ActorId,
    tenantId: TenantId,
  ): AppResultAsync<boolean, InfrastructureAppError> {
    return this.replaceRolesKeepingAdministrator(actorId, tenantId, []);
  }
}
