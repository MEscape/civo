import { describe, expect, it } from 'vitest';

import { RemoveUserAccess } from '@modules/auth/application/commands/remove-user-access';
import { SetUserAccess } from '@modules/auth/application/commands/set-user-access';
import type { ListPlatformUsersOptions } from '@modules/auth/application/contracts/user-views';
import { ListInvitations } from '@modules/auth/application/queries/list-invitations';
import { ListManageableWebsites } from '@modules/auth/application/queries/list-manageable-websites';
import { ListPlatformUsers } from '@modules/auth/application/queries/list-platform-users';
import { ListUsers } from '@modules/auth/application/queries/list-users';
import {
  loadAuthorizedManagedWebsite,
  loadAuthorizedUserManagementScope,
} from '@modules/auth/application/services/load-authorized-user-management';

import { infrastructureError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { SCOPE_IDS as IDS, userManagementScopeWorld } from './support/user-management-scope-world';

const OPTIONS: ListPlatformUsersOptions = {
  tenantId: null,
  text: null,
  role: null,
  onlyPlatformAdmins: false,
  sort: { field: 'name', direction: 'asc' },
  page: { page: 1, pageSize: 25 },
};

describe('user management across independently authorized websites', () => {
  it('resolves A and B even when the current website only grants viewer access', async () => {
    const { deps } = userManagementScopeWorld();
    expect((await loadAuthorizedUserManagementScope(deps))._unsafeUnwrap().tenantIds).toEqual([
      IDS.a,
      IDS.b,
    ]);
    expect((await loadAuthorizedManagedWebsite(deps, IDS.b))._unsafeUnwrap().tenantId).toBe(IDS.b);
    expect((await loadAuthorizedManagedWebsite(deps, IDS.c))._unsafeUnwrapErr().kind).toBe(
      'forbidden',
    );
    expect(
      (await new ListUsers(deps).execute({ ...OPTIONS, tenantId: IDS.a }))._unsafeUnwrap()
        .canManage,
    ).toBe(true);
  });

  it('names only managed websites and refuses managers with no remaining authority', async () => {
    const { deps } = userManagementScopeWorld();
    expect(
      (await new ListManageableWebsites(deps).execute())
        ._unsafeUnwrap()
        .websites.map((website) => website.id),
    ).toEqual([IDS.a, IDS.b]);
    expect(
      (
        await loadAuthorizedUserManagementScope(userManagementScopeWorld({ managed: [] }).deps)
      ).isErr(),
    ).toBe(true);
  });

  it('lists only authorized people and strips their unrelated memberships', async () => {
    const { deps, directoryReads } = userManagementScopeWorld();
    const found = (await new ListPlatformUsers(deps).execute(OPTIONS))._unsafeUnwrap();
    expect(found.users.total).toBe(5);
    expect(found.users.items.map((user) => user.id)).toEqual([
      IDS.alpha,
      IDS.beta,
      IDS.manager,
      IDS.root,
      IDS.shared,
    ]);
    expect(found.users.items.find((user) => user.id === IDS.shared)?.memberships).toEqual([
      { tenantId: IDS.a, roles: ['editor'] },
      { tenantId: IDS.b, roles: ['viewer'] },
    ]);
    expect(found.canManagePlatform).toBe(false);
    expect(found.manageableTenantIds).toEqual([IDS.a, IDS.b]);
    expect(directoryReads.every((ids) => ids !== null && !ids.includes(IDS.secret))).toBe(true);
  });

  it('keeps search, role filtering, sorting, pagination, and totals inside the authorized set', async () => {
    const { deps } = userManagementScopeWorld();
    const list = new ListPlatformUsers(deps);
    const secret = (await list.execute({ ...OPTIONS, text: 'secret' }))._unsafeUnwrap();
    expect(secret.users.total).toBe(0);
    const editors = (await list.execute({ ...OPTIONS, role: 'editor' }))._unsafeUnwrap();
    expect(editors.users.items.map((user) => user.id)).toEqual([IDS.beta, IDS.shared]);
    const page = (
      await list.execute({
        ...OPTIONS,
        page: { page: 2, pageSize: 2 },
        sort: { field: 'name', direction: 'desc' },
      })
    )._unsafeUnwrap();
    expect(page.users.items.map((user) => user.id)).toEqual([IDS.manager, IDS.beta]);
    expect(page.users.total).toBe(5);
    expect(page.users.pageCount).toBe(3);
  });

  it('rejects a forged website filter before querying account identities', async () => {
    const { deps, directoryReads } = userManagementScopeWorld();
    expect(
      (
        await new ListPlatformUsers(deps).execute({ ...OPTIONS, tenantId: IDS.c })
      )._unsafeUnwrapErr().kind,
    ).toBe('forbidden');
    expect(directoryReads).toEqual([]);
    expect(
      (await new ListUsers(deps).execute({ ...OPTIONS, tenantId: IDS.c }))._unsafeUnwrapErr().kind,
    ).toBe('forbidden');
  });

  it('does not turn a platform-role filter into cross-tenant visibility', async () => {
    const { deps } = userManagementScopeWorld();
    const found = (
      await new ListPlatformUsers(deps).execute({ ...OPTIONS, onlyPlatformAdmins: true })
    )._unsafeUnwrap();
    expect(found.users.items.map((user) => user.id)).toEqual([IDS.root]);
    expect(found.users.total).toBe(1);
  });

  it('allows a platform administrator global accounts but only explicit website members in tenant scope', async () => {
    const { deps } = userManagementScopeWorld({ platform: true });
    const list = new ListPlatformUsers(deps);
    expect((await list.execute(OPTIONS))._unsafeUnwrap().users.total).toBe(7);
    const tenant = (
      await list.execute({ ...OPTIONS, tenantId: IDS.a, onlyPlatformAdmins: true })
    )._unsafeUnwrap();
    expect(tenant.users.items.map((user) => user.id)).toEqual([IDS.root]);
    const local = (
      await new ListUsers(deps).execute({ ...OPTIONS, tenantId: IDS.a, role: 'platform_admin' })
    )._unsafeUnwrap();
    expect(local.users.items.map((user) => user.id)).toEqual([IDS.root]);
    expect(local.users.items[0]?.isPlatformAdmin).toBe(true);
  });

  it('a manager of only A cannot discover B users through global counts or role filters', async () => {
    const { deps } = userManagementScopeWorld({ managed: [IDS.a] });
    const found = (
      await new ListPlatformUsers(deps).execute({ ...OPTIONS, role: 'editor' })
    )._unsafeUnwrap();
    expect(found.users.items.map((user) => user.id)).toEqual([IDS.shared]);
    expect(found.users.total).toBe(1);
    expect(found.users.items[0]?.memberships).toEqual([{ tenantId: IDS.a, roles: ['editor'] }]);
  });

  it('fails closed when current website permissions cannot be loaded', async () => {
    const { deps } = userManagementScopeWorld();
    deps.members.findRoles = () =>
      errAsync(infrastructureError('auth.membership_lookup_failed', 'unavailable'));
    deps.members.findTenantIdsWithRoles = () =>
      errAsync(infrastructureError('auth.membership_lookup_failed', 'unavailable'));
    expect((await new ListPlatformUsers(deps).execute(OPTIONS))._unsafeUnwrapErr().kind).toBe(
      'infrastructure',
    );
  });
});

describe('bootstrap roles and missing websites', () => {
  it('marks and filters verified configured platform administrators without a platform membership row', async () => {
    const { deps } = userManagementScopeWorld({
      platform: true,
      bootstrapAdminEmails: [' SHARED@example.org ', 'secret@example.org', 'beta@example.org'],
      unverified: [IDS.beta],
    });
    const query = new ListPlatformUsers(deps);
    const global = (await query.execute({ ...OPTIONS, onlyPlatformAdmins: true }))._unsafeUnwrap();
    expect(new Set(global.users.items.map((user) => user.id))).toEqual(
      new Set([IDS.root, IDS.unassociatedRoot, IDS.shared, IDS.secret]),
    );
    expect(global.users.items.every((user) => user.isPlatformAdmin)).toBe(true);
    const selected = (
      await query.execute({ ...OPTIONS, tenantId: IDS.a, onlyPlatformAdmins: true })
    )._unsafeUnwrap();
    expect(selected.users.items.map((user) => user.id)).toEqual([IDS.root, IDS.shared]);
    const tenant = (
      await new ListUsers(deps).execute({ ...OPTIONS, tenantId: IDS.a, role: 'platform_admin' })
    )._unsafeUnwrap();
    expect(tenant.users.items.map((user) => user.id)).toEqual([IDS.root, IDS.shared]);
    expect(tenant.users.items.every((user) => user.isPlatformAdmin)).toBe(true);
  });

  it('does not expose configured administrators outside a manager’s authorized websites', async () => {
    const { deps } = userManagementScopeWorld({
      bootstrapAdminEmails: ['shared@example.org', 'secret@example.org'],
    });
    const found = (
      await new ListPlatformUsers(deps).execute({ ...OPTIONS, onlyPlatformAdmins: true })
    )._unsafeUnwrap();
    expect(found.users.items.map((user) => user.id)).toEqual([IDS.root, IDS.shared]);
  });

  it('rejects a deleted website even when orphan memberships still authorize its old ID', async () => {
    const { deps, directoryReads } = userManagementScopeWorld();
    deps.tenants.findName = () => okAsync(null);
    expect(
      (await new ListUsers(deps).execute({ ...OPTIONS, tenantId: IDS.a }))._unsafeUnwrapErr().kind,
    ).toBe('validation');
    expect(directoryReads).toEqual([]);
  });
});

describe('website access mutations from global scope', () => {
  it('changes A independently while preserving the subject’s B and C roles', async () => {
    const { deps, roster } = userManagementScopeWorld();
    const result = await new SetUserAccess(deps).execute({
      userId: IDS.shared,
      tenantId: IDS.a,
      roles: ['viewer'],
      expectedRoles: ['editor'],
    });
    expect(result.isOk()).toBe(true);
    expect(roster.get(IDS.a)?.get(IDS.shared)).toEqual(['viewer']);
    expect(roster.get(IDS.b)?.get(IDS.shared)).toEqual(['viewer']);
    expect(roster.get(IDS.c)?.get(IDS.shared)).toEqual(['admin']);
  });

  it('removes only the explicitly selected authorized membership', async () => {
    const { deps, roster } = userManagementScopeWorld();
    const result = await new RemoveUserAccess(deps).execute({
      userId: IDS.shared,
      tenantId: IDS.b,
      expectedRoles: ['viewer'],
    });
    expect(result.isOk()).toBe(true);
    expect(roster.get(IDS.b)?.has(IDS.shared)).toBe(false);
    expect(roster.get(IDS.a)?.get(IDS.shared)).toEqual(['editor']);
    expect(roster.get(IDS.c)?.get(IDS.shared)).toEqual(['admin']);
  });

  it('rejects forged targets and platform roles without changing any membership', async () => {
    const { deps, roster } = userManagementScopeWorld();
    expect(
      (
        await new SetUserAccess(deps).execute({
          userId: IDS.shared,
          tenantId: IDS.c,
          roles: ['viewer'],
        })
      )._unsafeUnwrapErr().kind,
    ).toBe('forbidden');
    expect(
      (
        await new RemoveUserAccess(deps).execute({ userId: IDS.shared, tenantId: IDS.c })
      )._unsafeUnwrapErr().kind,
    ).toBe('forbidden');
    expect(
      (
        await new SetUserAccess(deps).execute({
          userId: IDS.shared,
          tenantId: IDS.a,
          roles: ['platform_admin'],
        })
      )._unsafeUnwrapErr().kind,
    ).toBe('validation');
    expect(roster.get(IDS.c)?.get(IDS.shared)).toEqual(['admin']);
    expect(roster.get(IDS.a)?.get(IDS.shared)).toEqual(['editor']);
  });

  it('answers an account outside every managed website like a missing one, and changes nothing', async () => {
    const { deps, roster } = userManagementScopeWorld();
    const unmanaged = await new SetUserAccess(deps).execute({
      userId: IDS.secret,
      tenantId: IDS.a,
      roles: ['admin'],
    });
    const missing = await new SetUserAccess(deps).execute({
      userId: 'no-such-account',
      tenantId: IDS.a,
      roles: ['admin'],
    });
    const removal = await new RemoveUserAccess(deps).execute({
      userId: IDS.secret,
      tenantId: IDS.a,
    });
    expect(unmanaged._unsafeUnwrapErr().code).toBe(missing._unsafeUnwrapErr().code);
    expect(unmanaged._unsafeUnwrapErr().kind).toBe('not_found');
    expect(removal._unsafeUnwrapErr().kind).toBe('not_found');
    expect(roster.get(IDS.a)?.has(IDS.secret)).toBe(false);
    expect(roster.get(IDS.c)?.get(IDS.secret)).toEqual(['editor']);
  });

  it('lets a platform administrator give an account outside the website its first access there', async () => {
    const { deps, roster } = userManagementScopeWorld({ platform: true });
    const result = await new SetUserAccess(deps).execute({
      userId: IDS.secret,
      tenantId: IDS.a,
      roles: ['viewer'],
    });
    expect(result.isOk()).toBe(true);
    expect(roster.get(IDS.a)?.get(IDS.secret)).toEqual(['viewer']);
  });

  it('forbids a manager from changing or removing their own access', async () => {
    const { deps, roster } = userManagementScopeWorld();
    expect(
      (
        await new SetUserAccess(deps).execute({
          userId: IDS.manager,
          tenantId: IDS.a,
          roles: ['admin', 'editor'],
        })
      )._unsafeUnwrapErr().code,
    ).toBe('auth.last_admin');
    expect(
      (
        await new RemoveUserAccess(deps).execute({ userId: IDS.manager, tenantId: IDS.a })
      )._unsafeUnwrapErr().code,
    ).toBe('auth.last_admin');
    expect(roster.get(IDS.a)?.get(IDS.manager)).toEqual(['admin']);
  });

  it('rejects stale replacements and removals instead of overwriting newer access', async () => {
    const { deps, roster } = userManagementScopeWorld();
    roster.get(IDS.a)?.set(IDS.shared, ['editor', 'contributor']);
    const replace = await new SetUserAccess(deps).execute({
      userId: IDS.shared,
      tenantId: IDS.a,
      roles: ['viewer'],
      expectedRoles: ['editor'],
    });
    const remove = await new RemoveUserAccess(deps).execute({
      userId: IDS.shared,
      tenantId: IDS.a,
      expectedRoles: ['editor'],
    });
    expect(replace._unsafeUnwrapErr().kind).toBe('conflict');
    expect(remove._unsafeUnwrapErr().kind).toBe('conflict');
    expect(roster.get(IDS.a)?.get(IDS.shared)).toEqual(['editor', 'contributor']);
  });

  it('refuses a queued write after the manager loses authority', async () => {
    const { deps, roster } = userManagementScopeWorld();
    const search = deps.directory.search;
    deps.directory.search = (query) => {
      roster.get(IDS.a)?.set(IDS.manager, ['viewer']);
      return search(query);
    };
    const result = await new SetUserAccess(deps).execute({
      userId: IDS.shared,
      tenantId: IDS.a,
      roles: ['viewer'],
      expectedRoles: ['editor'],
    });
    expect(result._unsafeUnwrapErr().kind).toBe('conflict');
    expect(roster.get(IDS.a)?.get(IDS.shared)).toEqual(['editor']);
  });
});

describe('pending invitations obey the same website authorization as users', () => {
  it('includes only managed website offers in global rows, totals, names, and pagination', async () => {
    const { deps, invitationReads } = userManagementScopeWorld();
    const found = (
      await new ListInvitations(deps).execute({ page: 1, pageSize: 1 }, { kind: 'global' })
    )._unsafeUnwrap();
    expect(found.total).toBe(2);
    expect(found.pageCount).toBe(2);
    expect(found.items.map((invitation) => invitation.tenantId)).toEqual([IDS.b]);
    expect(found.items[0]?.websiteName).toBe('Website site-b');
    expect(invitationReads.flat()).not.toContain(IDS.c);
    expect(invitationReads.flat()).not.toContain('platform');
  });

  it('selects one managed website and denies an unrelated website before reading offers', async () => {
    const { deps, invitationReads } = userManagementScopeWorld();
    const query = new ListInvitations(deps);
    expect(
      (await query.execute(OPTIONS.page, { kind: 'website', tenantId: IDS.c }))._unsafeUnwrapErr()
        .kind,
    ).toBe('forbidden');
    expect(invitationReads).toEqual([]);
    expect(
      (await query.execute(OPTIONS.page, { kind: 'global', tenantId: IDS.a }))
        ._unsafeUnwrap()
        .items.map((invitation) => invitation.tenantId),
    ).toEqual([IDS.a]);
  });

  it('includes explicit platform offers only for platform administrators in global scope', async () => {
    const { deps } = userManagementScopeWorld({ platform: true });
    const query = new ListInvitations(deps);
    const global = (await query.execute(OPTIONS.page, { kind: 'global' }))._unsafeUnwrap();
    expect(global.total).toBe(4);
    expect(global.items.find((invitation) => invitation.role === 'platform_admin')).toMatchObject({
      tenantId: 'platform',
      websiteName: null,
    });
    const tenant = (
      await query.execute(OPTIONS.page, { kind: 'website', tenantId: IDS.a })
    )._unsafeUnwrap();
    expect(tenant.total).toBe(1);
    expect(tenant.items[0]?.tenantId).toBe(IDS.a);
  });
});
