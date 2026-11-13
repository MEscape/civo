import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toTenantId } from '@modules/auth/domain/models/ids';
import { loadUsersAdministration } from '@modules/auth/presentation/loaders/load-users-administration';
import type { UsersScope } from '@modules/auth/presentation/loaders/load-users-administration';

import { toPage } from '@lib/pagination';
import type { PageRequest } from '@lib/pagination';
import { okAsync } from '@lib/result';

vi.mock('@i18n/server', () => ({ getTranslations: async () => () => '' }));

const WEBSITE: UsersScope = {
  kind: 'website',
  websiteId: 'one',
  globalUsersHref: '/websites/users',
};
const GLOBAL: UsersScope = { kind: 'global', websiteUsersHref: (id) => `/websites/${id}/users` };

const PERSON = {
  id: 'ada',
  email: 'ada@example.org',
  name: 'Ada',
  emailVerified: true,
  createdAt: new Date(0),
  isPlatformAdmin: false,
};

function readers() {
  const listUsers = vi.fn();
  const listPlatformUsers = vi.fn();
  const listInvitations = vi.fn((page: PageRequest) =>
    okAsync({ ...toPage([], 45, page), isTruncated: false }),
  );
  const listManageableWebsites = vi.fn(() =>
    okAsync({ websites: [{ id: toTenantId('one'), name: 'One' }], isTruncated: false }),
  );
  listUsers.mockImplementation(() =>
    okAsync({
      users: toPage([{ ...PERSON, roles: ['viewer'] }], 100, { page: 3, pageSize: 25 }),
      tenantId: 'one',
      websiteName: 'One',
      selfId: 'actor',
      canManage: true,
      isTruncated: false,
    }),
  );
  listPlatformUsers.mockImplementation(() =>
    okAsync({
      users: toPage([{ ...PERSON, memberships: [{ tenantId: 'one', roles: ['viewer'] }] }], 75, {
        page: 2,
        pageSize: 25,
      }),
      selfId: 'actor',
      isTruncated: false,
      canManagePlatform: false,
      manageableTenantIds: ['one'],
    }),
  );
  return {
    queries: {
      listUsers: { execute: listUsers },
      listPlatformUsers: { execute: listPlatformUsers },
      listInvitations: { execute: listInvitations },
      listManageableWebsites: { execute: listManageableWebsites },
    },
    listUsers,
    listPlatformUsers,
    listInvitations,
    listManageableWebsites,
  };
}

describe('user administration inside one website', () => {
  let world: ReturnType<typeof readers>;
  beforeEach(() => {
    world = readers();
  });

  it('reads the website, shapes every person like a cross-website row and keeps invitation pages independent', async () => {
    const view = await loadUsersAdministration({
      locale: 'en',
      pathname: '/websites/one/users',
      scope: WEBSITE,
      queries: world.queries,
      searchParams: {
        page: '3',
        invitationsPage: '3',
        q: 'ada',
        role: 'viewer',
        sort: '-createdAt',
      },
    });
    expect(world.listUsers).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'one', text: 'ada', role: 'viewer' }),
    );
    expect(world.listInvitations).toHaveBeenCalledWith(expect.anything(), {
      kind: 'website',
      tenantId: 'one',
    });
    expect(world.listPlatformUsers).not.toHaveBeenCalled();
    expect(view.users.items[0]?.memberships).toEqual([{ tenantId: 'one', roles: ['viewer'] }]);
    expect(view.websites).toEqual([{ id: 'one', name: 'One' }]);
    expect(view.manageableTenantIds).toEqual(['one']);
    expect(view.canManagePlatform).toBe(false);
    expect(view.invitations.total).toBe(45);
    expect(view.invitations.pageCount).toBe(3);
    const invitationUrl = new URL(view.invitationsHrefFor(2), 'http://localhost');
    expect(Object.fromEntries(invitationUrl.searchParams)).toEqual({
      q: 'ada',
      role: 'viewer',
      pageSize: '25',
      sort: '-createdAt',
      page: '3',
      invitationsPage: '2',
    });
    const usersUrl = new URL(view.hrefFor(4), 'http://localhost');
    expect(usersUrl.searchParams.get('invitationsPage')).toBe('3');
    expect(usersUrl.searchParams.get('page')).toBe('4');
  });

  it('offers no management of anyone for a viewer', async () => {
    world.listUsers.mockImplementation(() =>
      okAsync({
        users: toPage([], 0, { page: 1, pageSize: 25 }),
        tenantId: 'one',
        websiteName: 'One',
        selfId: 'actor',
        canManage: false,
        isTruncated: false,
      }),
    );
    const view = await loadUsersAdministration({
      locale: 'en',
      pathname: '/websites/one/users',
      scope: WEBSITE,
      queries: world.queries,
      searchParams: {},
    });
    expect(view.canManage).toBe(false);
    expect(view.manageableTenantIds).toEqual([]);
  });

  it('ignores a website filter in the address: the scope is the website', async () => {
    const view = await loadUsersAdministration({
      locale: 'en',
      pathname: '/websites/one/users',
      scope: WEBSITE,
      queries: world.queries,
      searchParams: { website: 'other' },
    });
    expect(view.websiteId).toBeNull();
    expect(world.listInvitations).toHaveBeenCalledWith(expect.anything(), {
      kind: 'website',
      tenantId: 'one',
    });
    expect(world.listManageableWebsites).not.toHaveBeenCalled();
  });

  it('bounds invalid invitation page input and omits the first page from links', async () => {
    const view = await loadUsersAdministration({
      locale: 'en',
      pathname: '/users',
      scope: WEBSITE,
      queries: world.queries,
      searchParams: { invitationsPage: '-8' },
    });
    expect(view.invitations.page).toBe(1);
    expect(view.invitations.pageSize).toBe(20);
    expect(
      new URL(view.invitationsHrefFor(1), 'http://localhost').searchParams.has('invitationsPage'),
    ).toBe(false);
  });
});

describe('user administration across websites', () => {
  it('uses the selected website for both users and invitations and retains both pages', async () => {
    const world = readers();
    world.listInvitations.mockImplementation((page: PageRequest) =>
      okAsync({ ...toPage([], 45, { ...page, page: 3 }), isTruncated: false }),
    );
    const view = await loadUsersAdministration({
      locale: 'en',
      pathname: '/users',
      scope: GLOBAL,
      queries: world.queries,
      searchParams: { website: 'one', role: 'platform_admin', page: '2', invitationsPage: '3' },
    });
    expect(world.listPlatformUsers).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'one', role: null, onlyPlatformAdmins: true }),
    );
    expect(world.listInvitations).toHaveBeenCalledWith(
      { page: 3, pageSize: 20 },
      { kind: 'global', tenantId: 'one' },
    );
    expect(world.listUsers).not.toHaveBeenCalled();
    const nextUsers = new URL(view.hrefFor(3), 'https://example.org');
    const nextInvitations = new URL(view.invitationsHrefFor(2), 'https://example.org');
    expect(nextUsers.searchParams.get('invitationsPage')).toBe('3');
    expect(nextUsers.searchParams.get('website')).toBe('one');
    expect(nextInvitations.searchParams.get('page')).toBe('2');
    expect(nextInvitations.searchParams.get('role')).toBe('platform_admin');
    expect(view.canManagePlatform).toBe(false);
    expect(view.canManage).toBe(true);
    expect(view.websites).toEqual([{ id: 'one', name: 'One' }]);
  });

  it('treats the all-websites filter as authorized global scope', async () => {
    const world = readers();
    await loadUsersAdministration({
      locale: 'en',
      pathname: '/users',
      scope: GLOBAL,
      queries: world.queries,
      searchParams: { website: 'any' },
    });
    expect(world.listPlatformUsers).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: null, onlyPlatformAdmins: false }),
    );
    expect(world.listInvitations).toHaveBeenCalledWith(expect.anything(), { kind: 'global' });
  });

  it('reports a truncated website list or invitation scope', async () => {
    const world = readers();
    world.queries.listManageableWebsites.execute.mockImplementation(() =>
      okAsync({ websites: [{ id: toTenantId('one'), name: 'One' }], isTruncated: true }),
    );
    const view = await loadUsersAdministration({
      locale: 'en',
      pathname: '/users',
      scope: GLOBAL,
      queries: world.queries,
      searchParams: {},
    });
    expect(view.isWebsiteListTruncated).toBe(true);

    const other = readers();
    other.listInvitations.mockImplementation((page: PageRequest) =>
      okAsync({ ...toPage([], 0, page), isTruncated: true }),
    );
    expect(
      (
        await loadUsersAdministration({
          locale: 'en',
          pathname: '/users',
          scope: GLOBAL,
          queries: other.queries,
          searchParams: {},
        })
      ).isWebsiteListTruncated,
    ).toBe(true);
  });
});
