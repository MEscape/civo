import { describe, expect, it } from 'vitest';

import type { PlatformAccessDependencies } from '@modules/auth/application/auth-dependencies';
import { RemoveUserAccess } from '@modules/auth/application/commands/remove-user-access';
import { SetUserAccess } from '@modules/auth/application/commands/set-user-access';
import type { ListPlatformUsersOptions } from '@modules/auth/application/queries/list-platform-users';
import { ListPlatformUsers } from '@modules/auth/application/queries/list-platform-users';
import { permissionDenied } from '@modules/auth/domain/errors/auth-errors';
import { decide } from '@modules/auth/domain/models/authorize';
import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import type { ActorId, TenantId } from '@modules/auth/domain/models/ids';
import type { Role, TenantRole } from '@modules/auth/domain/models/role';

import { toPage } from '@lib/pagination';
import { errAsync, okAsync } from '@lib/result';

const ADMIN = toActorId('platform-admin');
const ANNA = toActorId('anna');
const BEN = toActorId('ben');
const SITE_A = toTenantId('site-a');
const SITE_B = toTenantId('site-b');
const PAGE = { page: 1, pageSize: 25 };
const SORT = { field: 'name', direction: 'asc' } as const;

/** Two websites, three people, one of them an administrator of the platform. */
function world(options: { readonly actorRoles?: readonly Role[] } = {}) {
  const memberships = new Map<string, TenantRole[]>([
    [`${ANNA}|${SITE_A}`, ['admin']],
    [`${ANNA}|${SITE_B}`, ['editor']],
    [`${BEN}|${SITE_A}`, ['viewer']],
  ]);
  const audit: Array<{ type: string; tenantId: TenantId; subjectId: ActorId }> = [];
  const accounts = [
    { id: ANNA, name: 'Anna', email: 'anna@example.org' },
    { id: BEN, name: 'Ben', email: 'ben@example.org' },
    { id: ADMIN, name: 'Root', email: 'root@example.org' },
  ];
  const actorRoles = options.actorRoles ?? ['platform_admin'];

  const rolesOf = (id: ActorId, tenant: TenantId) => memberships.get(`${id}|${tenant}`) ?? [];
  const administrators = (tenant: TenantId) =>
    [...memberships].filter(([key, roles]) => key.endsWith(`|${tenant}`) && roles.includes('admin'))
      .length;

  const members = {
    listPlatformAdmins: () => okAsync([ADMIN]),
    findRoles: (id: ActorId, tenant: TenantId) => okAsync(rolesOf(id, tenant)),
    findMemberIds: (filter: { tenantId: TenantId | null; role: TenantRole | null }) => {
      const ids = new Set<ActorId>();
      for (const [key, roles] of memberships) {
        const [actor = '', tenant = ''] = key.split('|');
        if (
          (filter.tenantId === null || filter.tenantId === tenant) &&
          (filter.role === null || roles.includes(filter.role))
        ) {
          ids.add(toActorId(actor));
        }
      }
      return okAsync({ ids: [...ids], isTruncated: false });
    },
    listMembershipsOf: (ids: readonly ActorId[]) => {
      const result = new Map<ActorId, Array<{ tenantId: TenantId; roles: TenantRole[] }>>();
      for (const [key, roles] of memberships) {
        const [actor = '', tenant = ''] = key.split('|');
        if (ids.includes(toActorId(actor))) {
          result.set(toActorId(actor), [
            ...(result.get(toActorId(actor)) ?? []),
            { tenantId: toTenantId(tenant), roles },
          ]);
        }
      }
      return okAsync(result);
    },
    replaceRoles: (id: ActorId, tenant: TenantId, next: readonly TenantRole[]) => {
      memberships.set(`${id}|${tenant}`, [...next]);
      return okAsync(undefined);
    },
    replaceRolesKeepingAdministrator: (
      id: ActorId,
      tenant: TenantId,
      next: readonly TenantRole[],
    ) => {
      const isLast = rolesOf(id, tenant).includes('admin') && administrators(tenant) <= 1;
      if (isLast && !next.includes('admin')) {
        return okAsync(false);
      }
      memberships.set(`${id}|${tenant}`, [...next]);
      return okAsync(true);
    },
    removeMemberKeepingAdministrator: (id: ActorId, tenant: TenantId) => {
      const isLast = rolesOf(id, tenant).includes('admin') && administrators(tenant) <= 1;
      if (isLast) {
        return okAsync(false);
      }
      memberships.delete(`${id}|${tenant}`);
      return okAsync(true);
    },
  };

  const directory = {
    search: (query: { ids: readonly ActorId[] | null; text: string | null; page: typeof PAGE }) => {
      const found = accounts.filter(
        (account) =>
          (query.ids === null || query.ids.includes(account.id)) &&
          (query.text === null || account.name.toLowerCase().includes(query.text.toLowerCase())),
      );
      return okAsync(
        toPage(
          found.map((account) => ({
            ...account,
            emailVerified: true,
            createdAt: new Date('2026-01-01T00:00:00Z'),
          })),
          found.length,
          query.page,
        ),
      );
    },
  };

  const authorization = {
    requireInTenant: (permission: Parameters<typeof decide>[1]) => {
      const actor = { id: ADMIN, tenantId: toTenantId('platform'), roles: actorRoles };
      return decide(actor, permission).isAllowed ? okAsync(actor) : errAsync(permissionDenied());
    },
  };

  const dependencies = {
    authorization,
    members,
    directory,
    tenants: { exists: (tenant: TenantId) => okAsync(tenant === SITE_A || tenant === SITE_B) },
    audit: { record: (event: (typeof audit)[number]) => audit.push(event) },
  } as unknown as PlatformAccessDependencies;

  return { dependencies, memberships, audit };
}

const options: ListPlatformUsersOptions = {
  text: null,
  tenantId: null,
  role: null,
  onlyPlatformAdmins: false,
  sort: SORT,
  page: PAGE,
};

describe('listing people across every website', () => {
  it('lists everyone with the websites they work in and whether they administer the platform', async () => {
    const { dependencies } = world();

    const listing = (await new ListPlatformUsers(dependencies).execute(options))._unsafeUnwrap();
    const anna = listing.users.items.find((user) => user.id === ANNA);

    expect(listing.users.total).toBe(3);
    expect(anna?.memberships).toEqual([
      { tenantId: SITE_A, roles: ['admin'] },
      { tenantId: SITE_B, roles: ['editor'] },
    ]);
    expect(listing.users.items.find((user) => user.id === ADMIN)?.isPlatformAdmin).toBe(true);
    expect(anna?.isPlatformAdmin).toBe(false);
  });

  it('narrows by website, by role, by being an administrator, and by text', async () => {
    const list = async (narrow: Partial<ListPlatformUsersOptions>) =>
      (await new ListPlatformUsers(world().dependencies).execute({ ...options, ...narrow }))
        ._unsafeUnwrap()
        .users.items.map((user) => user.name);

    expect(await list({ tenantId: SITE_B })).toEqual(['Anna']);
    expect(await list({ tenantId: SITE_A })).toEqual(['Anna', 'Ben']);
    expect(await list({ role: 'viewer' })).toEqual(['Ben']);
    expect(await list({ onlyPlatformAdmins: true })).toEqual(['Root']);
    expect(await list({ text: 'ben' })).toEqual(['Ben']);
    expect(await list({ tenantId: SITE_A, role: 'editor' })).toEqual([]);
  });

  it('is for the platform’s administrators alone', async () => {
    const { dependencies } = world({ actorRoles: ['admin'] });

    expect((await new ListPlatformUsers(dependencies).execute(options)).isErr()).toBe(true);
  });
});

describe('changing a person’s access to a website from outside it', () => {
  it('sets the roles, adds a person who is not yet a member, and records it in the website’s trail', async () => {
    const { dependencies, memberships, audit } = world();

    await new SetUserAccess(dependencies).execute({
      userId: BEN,
      tenantId: SITE_A,
      roles: ['editor', 'contributor'],
    });
    await new SetUserAccess(dependencies).execute({
      userId: BEN,
      tenantId: SITE_B,
      roles: ['viewer'],
    });

    expect(memberships.get(`${BEN}|${SITE_A}`)).toEqual(['editor', 'contributor']);
    expect(memberships.get(`${BEN}|${SITE_B}`)).toEqual(['viewer']);
    expect(audit.map((event) => [event.type, event.tenantId])).toEqual([
      ['membership.roles_changed', SITE_A],
      ['membership.roles_changed', SITE_B],
    ]);
  });

  it('refuses a website that does not exist and an unknown person', async () => {
    const { dependencies } = world();
    const set = (input: { userId: string; tenantId: string }) =>
      new SetUserAccess(dependencies).execute({ ...input, roles: ['viewer'] });

    expect((await set({ userId: BEN, tenantId: 'nowhere' }))._unsafeUnwrapErr().kind).toBe(
      'validation',
    );
    expect((await set({ userId: 'nobody', tenantId: SITE_A }))._unsafeUnwrapErr().kind).toBe(
      'not_found',
    );
  });

  it('lets a platform administrator manage their own access, like anyone’s', async () => {
    const { dependencies, memberships } = world();

    const join = await new SetUserAccess(dependencies).execute({
      userId: ADMIN,
      tenantId: SITE_A,
      roles: ['editor'],
    });
    expect(join.isOk()).toBe(true);
    expect(memberships.get(`${ADMIN}|${SITE_A}`)).toEqual(['editor']);

    const leave = await new RemoveUserAccess(dependencies).execute({
      userId: ADMIN,
      tenantId: SITE_A,
    });
    expect(leave.isOk()).toBe(true);
    expect(memberships.has(`${ADMIN}|${SITE_A}`)).toBe(false);
  });

  it('keeps the last administrator of a website, whether the roles change or the person is removed', async () => {
    const { dependencies, memberships } = world();

    const demote = await new SetUserAccess(dependencies).execute({
      userId: ANNA,
      tenantId: SITE_A,
      roles: ['viewer'],
    });
    const remove = await new RemoveUserAccess(dependencies).execute({
      userId: ANNA,
      tenantId: SITE_A,
    });

    expect(demote._unsafeUnwrapErr().kind).toBe('conflict');
    expect(remove._unsafeUnwrapErr().kind).toBe('conflict');
    expect(memberships.get(`${ANNA}|${SITE_A}`)).toEqual(['admin']);
  });

  it('removes access to one website and leaves the others', async () => {
    const { dependencies, memberships, audit } = world();

    await new RemoveUserAccess(dependencies).execute({ userId: ANNA, tenantId: SITE_B });

    expect(memberships.has(`${ANNA}|${SITE_B}`)).toBe(false);
    expect(memberships.has(`${ANNA}|${SITE_A}`)).toBe(true);
    expect(audit.map((event) => event.type)).toEqual(['membership.removed']);
  });

  it('is for the platform’s administrators alone', async () => {
    const { dependencies } = world({ actorRoles: ['admin'] });

    const result = await new SetUserAccess(dependencies).execute({
      userId: BEN,
      tenantId: SITE_A,
      roles: ['viewer'],
    });

    expect(result.isErr()).toBe(true);
  });
});
