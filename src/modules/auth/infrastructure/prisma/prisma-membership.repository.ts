import { createPersistenceFailures, db } from '@lib/db';
import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import { logger } from '@lib/logger';
import { err, fromThrowableAsync, ok, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { AUTH_ERROR_CODES, lastAdmin } from '../../domain/errors/auth-errors';
import { toActorId, toTenantId } from '../../domain/models/ids';
import { PLATFORM_ADMIN_ROLE, ROLES, isRole } from '../../domain/models/role';
import { PLATFORM_TENANT_ID } from '../../domain/models/tenant';
import { MAX_TENANT_MEMBERS } from '../../domain/ports/membership.repository';
import {
  grantMembershipRole,
  grantPlatformMembership,
  replaceMembershipRoles,
  revokePlatformMembership,
} from '../transactions/membership-role-writes';

import {
  MAX_MEMBERSHIP_ROWS,
  MEMBERSHIP_SELECT,
  toMemberRoster,
  toMembershipsByActor,
  toManagedTenants,
  toRoles,
} from './membership-record-mapper';

import type { ActorId, TenantId } from '../../domain/models/ids';
import type { TenantRole } from '../../domain/models/role';
import type {
  MemberCounts,
  MemberRoster,
  MembershipWriteOptions,
  MembershipRepository,
  TenantMembership,
} from '../../domain/ports/membership.repository';

const membershipLogger = logger.withContext({ module: 'auth.membership' });

const failures = createPersistenceFailures({
  module: 'auth.membership.persistence',
  code: AUTH_ERROR_CODES.membershipLookupFailed,
  subject: 'Membership',
});

/** More tenants than this for one person is a data error, not a case to serve. */
const MAX_TENANTS_PER_ACTOR = 50;

/**
 * Prisma 8 repository for memberships: the application's own record of who
 * holds which roles in which tenant. This, not the authentication provider,
 * is the source of truth for authorization.
 *
 * - Query results are awaitable but not `Promise`s, so the thunk is `async`
 *   and returns the query directly: the async wrapper awaits it.
 * - Website writes distinguish last-administrator protection (`auth.last_admin`)
 *   from a changed role baseline or authority (`false`).
 *
 * `actorId` has no foreign key to Better Auth's user table: the two live in
 * different databases/roles by design. See the Membership model in prisma/schema/access.prisma.
 */
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

  listPlatformAdmins(
    limit: number,
  ): AppResultAsync<
    { readonly ids: readonly ActorId[]; readonly isTruncated: boolean },
    InfrastructureAppError
  > {
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
          .limit(limit + 1)
          .all(),
      failures.infraOnly('listPlatformAdmins'),
    ).map((records) => ({
      ids: records.slice(0, limit).map((record) => toActorId(record.actorId)),
      isTruncated: records.length > limit,
    }));
  }

  grantPlatformAdmin(
    actorId: ActorId,
    options?: MembershipWriteOptions,
  ): AppResultAsync<boolean, InfrastructureAppError> {
    return fromThrowableAsync(
      () => grantPlatformMembership(actorId, options),
      failures.infraOnly('grantPlatformAdmin'),
    );
  }

  revokePlatformAdmin(
    subjectId: ActorId,
    actor: Parameters<MembershipRepository['revokePlatformAdmin']>[1],
  ): AppResultAsync<boolean, InfrastructureAppError> {
    return fromThrowableAsync(
      () => revokePlatformMembership(subjectId, actor),
      failures.infraOnly('revokePlatformAdmin'),
    );
  }

  /** @owner-scope actor The default website belongs to the authenticated person. */
  findFirstTenant(actorId: ActorId): AppResultAsync<TenantId | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.Membership.where({ actorId })
          .where((membership) => membership.tenantId.neq(PLATFORM_TENANT_ID))
          .select('tenantId')
          .orderBy([
            (membership) => membership.createdAt.asc(),
            (membership) => membership.id.asc(),
          ])
          .first(),
      failures.infraOnly('findFirstTenant'),
    ).map((record) => (record === null ? null : toTenantId(record.tenantId)));
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

  countMembers(tenantId: TenantId): AppResultAsync<MemberCounts, InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      // A person holding two roles has two rows, so the people are counted distinct in the database.
      const distinctMembers = db.raw
        .sql`SELECT count(DISTINCT "actorId")::int AS members FROM "Membership" WHERE "tenantId" = ${tenantId}`
        .returnsRow({ members: { codecId: 'pg/int4@1', nullable: false } })
        .build();
      const [people, roles] = await Promise.all([
        db.runtime().query(distinctMembers).firstOrThrow(),
        db.orm.public.Membership.where({ tenantId })
          .groupBy('role')
          .aggregate((aggregate) => ({ count: aggregate.count() })),
      ]);
      return { members: people.members, roles };
    }, failures.infraOnly('countMembers')).map(({ members, roles }) => ({
      members,
      byRole: new Map(
        roles.flatMap(({ role, count }) => (isRole(role) ? [[role, count] as const] : [])),
      ),
    }));
  }

  /** @owner-scope platform Everyone who works in any website, for the platform administrator's user list. */
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
  > {
    const { tenantIds } = filter;
    if (tenantIds?.length === 0) {
      return okAsync({ ids: [], isTruncated: false });
    }
    return fromThrowableAsync(async () => {
      const members = db.orm.public.Membership.where({
        ...(filter.tenantId === null ? {} : { tenantId: filter.tenantId }),
        ...(filter.role === null ? {} : { role: filter.role }),
      }).where((membership) => membership.tenantId.neq(PLATFORM_TENANT_ID));
      const scoped =
        tenantIds === undefined
          ? members
          : members.where((membership) => membership.tenantId.in([...tenantIds]));
      return (
        scoped
          .groupBy('actorId')
          .orderBy([(membership) => membership.actorId.asc()])
          // Bound distinct people, not memberships: one person may work in many websites.
          .limit(limit + 1)
          .aggregate((aggregate) => ({ count: aggregate.count() }))
      );
    }, failures.infraOnly('findMemberIds')).map((rows) => {
      const ids = rows.map((row) => toActorId(row.actorId));
      return { ids: ids.slice(0, limit), isTruncated: ids.length > limit };
    });
  }

  /** @owner-scope actor The websites the person holds one of the roles in: bound to the person's own id. */
  findTenantIdsWithRoles(
    actorId: ActorId,
    roles: readonly TenantRole[],
    limit: number,
  ): AppResultAsync<
    { readonly tenantIds: readonly TenantId[]; readonly isTruncated: boolean },
    InfrastructureAppError
  > {
    if (roles.length === 0) {
      return okAsync({ tenantIds: [], isTruncated: false });
    }
    // One person may hold several of the roles in one website: bound the rows, then count distinct websites.
    const rowLimit = limit * roles.length;
    return fromThrowableAsync(
      async () =>
        db.orm.public.Membership.where({ actorId })
          .where((membership) => membership.tenantId.neq(PLATFORM_TENANT_ID))
          .where((membership) => membership.role.in([...roles]))
          .select('tenantId')
          .orderBy([
            (membership) => membership.createdAt.asc(),
            (membership) => membership.id.asc(),
          ])
          .limit(rowLimit + 1)
          .all(),
      failures.infraOnly('findTenantIdsWithRoles'),
    ).map((records) => toManagedTenants(records, limit, rowLimit));
  }

  /** @owner-scope platform The memberships of the people on one page of the platform administrator's user list. */
  listMembershipsOf(
    actorIds: readonly ActorId[],
    tenantIds?: readonly TenantId[],
  ): AppResultAsync<ReadonlyMap<ActorId, readonly TenantMembership[]>, InfrastructureAppError> {
    if (actorIds.length === 0) {
      return okAsync(new Map());
    }
    const rowLimit = actorIds.length * MAX_TENANTS_PER_ACTOR * ROLES.length;
    return fromThrowableAsync(async () => {
      const memberships = db.orm.public.Membership.where((membership) =>
        membership.actorId.in([...actorIds]),
      ).where((membership) => membership.tenantId.neq(PLATFORM_TENANT_ID));
      const scoped =
        tenantIds === undefined
          ? memberships
          : memberships.where((membership) => membership.tenantId.in([...tenantIds]));
      const records = await scoped
        .select('actorId', 'tenantId', 'role')
        .orderBy([
          (membership) => membership.createdAt.asc(),
          (membership) => membership.role.asc(),
        ])
        .limit(rowLimit + 1)
        .all();
      return records;
    }, failures.infraOnly('listMembershipsOf')).andThen((records) =>
      // Exceeding the budget fails explicitly rather than presenting an incomplete access list.
      records.length > rowLimit
        ? err(failures.infraOnly('listMembershipsOf')(new Error('Membership listing over budget.')))
        : ok(toMembershipsByActor(records)),
    );
  }

  listMembers(
    tenantId: TenantId,
    filter: { readonly role: TenantRole | null },
  ): AppResultAsync<MemberRoster, InfrastructureAppError> {
    return this.findMemberIds({ tenantId, role: filter.role }, MAX_TENANT_MEMBERS).andThen(
      ({ ids, isTruncated }) => {
        if (ids.length === 0) {
          return okAsync({ members: new Map(), isTruncated });
        }
        return fromThrowableAsync(
          async () =>
            db.orm.public.Membership.where({ tenantId })
              .where((membership) => membership.actorId.in([...ids]))
              .select('actorId', 'role')
              .orderBy([
                (membership) => membership.actorId.asc(),
                (membership) => membership.role.asc(),
              ])
              .limit(ids.length * ROLES.length)
              .all(),
          failures.infraOnly('listMembers'),
        ).map((records) => toMemberRoster(records, isTruncated));
      },
    );
  }

  grantRole(
    actorId: ActorId,
    tenantId: TenantId,
    role: TenantRole,
  ): AppResultAsync<void, InfrastructureAppError> {
    return fromThrowableAsync(
      () => grantMembershipRole(actorId, tenantId, role),
      failures.infraOnly('grantRole'),
    );
  }

  replaceRolesKeepingAdministrator(
    actorId: ActorId,
    tenantId: TenantId,
    input: MembershipWriteOptions & { readonly roles: readonly TenantRole[] },
  ): AppResultAsync<boolean, InfrastructureAppError | ConflictAppError> {
    return fromThrowableAsync(
      () => replaceMembershipRoles(actorId, tenantId, input),
      failures.infraOnly('replaceRolesKeepingAdministrator'),
    ).andThen((outcome) => (outcome === 'last_admin' ? err(lastAdmin()) : ok(outcome)));
  }

  removeMemberKeepingAdministrator(
    actorId: ActorId,
    tenantId: TenantId,
    options?: MembershipWriteOptions,
  ): AppResultAsync<boolean, InfrastructureAppError | ConflictAppError> {
    return this.replaceRolesKeepingAdministrator(actorId, tenantId, { ...options, roles: [] });
  }
}
