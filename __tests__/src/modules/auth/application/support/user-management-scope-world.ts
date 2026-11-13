import type { UserAdministrationDependencies } from '@modules/auth/application/auth-dependencies';
import { permissionDenied } from '@modules/auth/domain/errors/auth-errors';
import type { Actor } from '@modules/auth/domain/models/actor';
import { actorHasPermission, decide } from '@modules/auth/domain/models/authorize';
import { toActorId, toInvitationId, toTenantId } from '@modules/auth/domain/models/ids';
import type { ActorId, TenantId } from '@modules/auth/domain/models/ids';
import type { Invitation } from '@modules/auth/domain/models/invitation';
import type { TenantRole } from '@modules/auth/domain/models/role';
import { PLATFORM_TENANT_ID } from '@modules/auth/domain/models/tenant';
import type {
  MembershipRepository,
  MembershipWriteOptions,
  TenantMembership,
} from '@modules/auth/domain/ports/membership.repository';
import type { DirectoryUser, UserDirectory } from '@modules/auth/domain/ports/user-directory.port';

import { toPage } from '@lib/pagination';
import type { PageRequest } from '@lib/pagination';
import { errAsync, okAsync } from '@lib/result';

import { administrationWorld } from './administration-world';

export const SCOPE_IDS = {
  a: toTenantId('site-a'),
  b: toTenantId('site-b'),
  c: toTenantId('site-c'),
  manager: toActorId('manager'),
  shared: toActorId('shared'),
  alpha: toActorId('alpha'),
  beta: toActorId('beta'),
  secret: toActorId('secret'),
  root: toActorId('root'),
  unassociatedRoot: toActorId('unassociated-root'),
};

const NOW = new Date('2026-10-29T12:00:00Z');

function rolesMatch(current: readonly TenantRole[], expected: readonly TenantRole[]) {
  return current.length === expected.length && current.every((role) => expected.includes(role));
}

function canWrite(
  actor: Actor | undefined,
  tenantId: TenantId,
  rows: ReadonlyMap<ActorId, readonly TenantRole[]>,
) {
  return (
    actor === undefined ||
    actorHasPermission(actor, 'platform.admin.manage') ||
    actorHasPermission({ ...actor, tenantId, roles: rows.get(actor.id) ?? [] }, 'user.manage')
  );
}

/** C is visible to the manager as a viewer, but only A and B permit user management. */
export function userManagementScopeWorld(
  options: {
    platform?: boolean;
    managed?: readonly TenantId[];
    bootstrapAdminEmails?: readonly string[];
    unverified?: readonly ActorId[];
  } = {},
) {
  const ids = SCOPE_IDS;
  const managed = options.managed ?? [ids.a, ids.b];
  const roster = new Map<TenantId, Map<ActorId, readonly TenantRole[]>>([
    [
      ids.a,
      new Map<ActorId, readonly TenantRole[]>([
        [ids.manager, managed.includes(ids.a) ? ['admin'] : ['viewer']],
        [ids.shared, ['editor']],
        [ids.alpha, ['viewer']],
        [ids.root, ['viewer']],
      ]),
    ],
    [
      ids.b,
      new Map<ActorId, readonly TenantRole[]>([
        [ids.manager, managed.includes(ids.b) ? ['admin'] : ['viewer']],
        [ids.shared, ['viewer']],
        [ids.beta, ['editor']],
      ]),
    ],
    [
      ids.c,
      new Map<ActorId, readonly TenantRole[]>([
        [ids.manager, ['viewer']],
        [ids.shared, ['admin']],
        [ids.secret, ['editor']],
      ]),
    ],
  ]);
  const actor: Actor = {
    id: options.platform ? ids.unassociatedRoot : ids.manager,
    tenantId: ids.c,
    roles: options.platform ? ['platform_admin'] : ['viewer'],
    ...(options.platform ? { platformAuthority: 'membership' as const } : {}),
  };
  const base = administrationWorld().deps;
  function replace(
    id: ActorId,
    tenantId: TenantId,
    write: MembershipWriteOptions & { readonly roles: readonly TenantRole[] },
  ) {
    const next = write.roles;
    const rows = roster.get(tenantId);
    if (rows === undefined) {
      return okAsync(false);
    }
    const current = rows.get(id) ?? [];
    if (write?.expectedRoles !== undefined && !rolesMatch(current, write.expectedRoles)) {
      return okAsync(false);
    }
    if (!canWrite(write?.actor, tenantId, rows)) {
      return okAsync(false);
    }
    if (
      current.includes('admin') &&
      !next.includes('admin') &&
      [...rows.values()].filter((roles) => roles.includes('admin')).length <= 1
    ) {
      return okAsync(false);
    }
    if (next.length === 0) {
      rows.delete(id);
    } else {
      rows.set(id, next);
    }
    return okAsync(true);
  }
  const members: MembershipRepository = {
    ...base.members,
    findRoles: (id, tenantId) => okAsync(roster.get(tenantId)?.get(id) ?? []),
    listPlatformAdmins: () =>
      okAsync({ ids: [ids.root, ids.unassociatedRoot], isTruncated: false }),
    findTenantIdsWithRoles: (id, wanted) =>
      okAsync({
        tenantIds: [...roster]
          .filter(([, rows]) => (rows.get(id) ?? []).some((role) => wanted.includes(role)))
          .map(([tenantId]) => tenantId),
        isTruncated: false,
      }),
    listMembers: (tenantId, filter) =>
      okAsync({
        members: new Map(
          [...(roster.get(tenantId) ?? [])].filter(
            ([, roles]) => filter.role === null || roles.includes(filter.role),
          ),
        ),
        isTruncated: false,
      }),
    findMemberIds: (filter, limit) => {
      const found = new Set<ActorId>();
      for (const [tenantId, rows] of roster) {
        if (
          (filter.tenantId !== null && filter.tenantId !== tenantId) ||
          (filter.tenantIds !== undefined && !filter.tenantIds.includes(tenantId))
        ) {
          continue;
        }
        for (const [id, roles] of rows) {
          if (filter.role === null || roles.includes(filter.role)) {
            found.add(id);
          }
        }
      }
      return okAsync({ ids: [...found].slice(0, limit), isTruncated: found.size > limit });
    },
    listMembershipsOf: (actorIds, tenantIds) => {
      const found = new Map<ActorId, TenantMembership[]>();
      for (const [tenantId, rows] of roster) {
        if (tenantIds !== undefined && !tenantIds.includes(tenantId)) {
          continue;
        }
        for (const [id, roles] of rows) {
          if (actorIds.includes(id)) {
            found.set(id, [...(found.get(id) ?? []), { tenantId, roles }]);
          }
        }
      }
      return okAsync(found);
    },
    replaceRolesKeepingAdministrator: replace,
    removeMemberKeepingAdministrator: (id, tenantId, write) =>
      replace(id, tenantId, { ...write, roles: [] }),
  };
  const accounts: readonly DirectoryUser[] = [
    ids.manager,
    ids.shared,
    ids.alpha,
    ids.beta,
    ids.secret,
    ids.root,
    ids.unassociatedRoot,
  ].map((id) => ({
    id,
    name: id,
    email: `${id}@example.org`,
    emailVerified: !options.unverified?.includes(id),
    createdAt: NOW,
  }));
  const directoryReads: Array<readonly ActorId[] | null> = [];
  const directory: UserDirectory = {
    findByEmail: (email) =>
      okAsync(accounts.find((account) => account.email === email.toLowerCase()) ?? null),
    search: (query) => {
      directoryReads.push(query.ids);
      const found = accounts.filter(
        (account) =>
          (query.ids === null || query.ids.includes(account.id)) &&
          (query.text === null ||
            `${account.name} ${account.email}`.toLowerCase().includes(query.text.toLowerCase())),
      );
      const sorted = [...found].sort((left, right) => {
        const comparison = String(left[query.sort.field]).localeCompare(
          String(right[query.sort.field]),
        );
        return query.sort.direction === 'asc' ? comparison : -comparison;
      });
      const offset = (query.page.page - 1) * query.page.pageSize;
      return okAsync(
        toPage(sorted.slice(offset, offset + query.page.pageSize), sorted.length, query.page),
      );
    },
  };
  const pending: readonly Invitation[] = [ids.a, ids.b, ids.c, PLATFORM_TENANT_ID].map(
    (tenantId, index) => ({
      id: toInvitationId(`invitation-${tenantId}`),
      tenantId,
      email: `${tenantId}@example.org`,
      role: tenantId === PLATFORM_TENANT_ID ? 'platform_admin' : 'viewer',
      invitedBy: ids.manager,
      expiresAt: new Date('2026-10-30T12:00:00Z'),
      acceptedAt: null,
      createdAt: new Date(NOW.getTime() + index),
    }),
  );
  const invitationReads: TenantId[][] = [];
  function listPending(tenantIds: readonly TenantId[] | null, now: Date, page: PageRequest) {
    invitationReads.push(tenantIds === null ? [] : [...tenantIds]);
    const found = pending
      .filter(
        (invitation) =>
          (tenantIds === null || tenantIds.includes(invitation.tenantId)) &&
          invitation.expiresAt > now,
      )
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    const offset = (page.page - 1) * page.pageSize;
    return okAsync(toPage(found.slice(offset, offset + page.pageSize), found.length, page));
  }
  const deps = {
    ...base,
    bootstrapAdminEmails: new Set(options.bootstrapAdminEmails ?? []),
    members,
    directory,
    clock: { now: () => NOW },
    invitations: {
      ...base.invitations,
      listOpenForTenants: listPending,
    },
    authorization: {
      requireActor: () => okAsync(actor),
      requireInTenant: (permission) =>
        decide(actor, permission).isAllowed ? okAsync(actor) : errAsync(permissionDenied()),
      requireOnResource: (permission, scope) =>
        decide(actor, permission, scope).isAllowed ? okAsync(actor) : errAsync(permissionDenied()),
    },
    tenants: {
      exists: (tenantId) => okAsync(roster.has(tenantId)),
      findName: (tenantId) => okAsync(roster.has(tenantId) ? `Website ${tenantId}` : null),
      listNames: (tenantIds) =>
        okAsync({
          websites: [...roster.keys()]
            .filter((id) => tenantIds === null || tenantIds.includes(id))
            .map((id) => ({ id, name: `Website ${id}` })),
          isTruncated: false,
        }),
    },
  } satisfies UserAdministrationDependencies;
  return { deps, actor, roster, directoryReads, invitationReads };
}
