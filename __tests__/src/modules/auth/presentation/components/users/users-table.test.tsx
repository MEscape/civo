import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UsersTable } from '@modules/auth/presentation/components/users/users-table';

vi.mock('@i18n/server', () => ({
  getTranslations: async () => (key: string) => key,
  getAppFormatters: async () => ({ date: () => '2026-10-29' }),
}));
vi.mock('@i18n', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@modules/auth/presentation/components/users/user-access-editor.client', () => ({
  UserAccessEditor: ({
    canManagePlatform,
    websites,
  }: {
    canManagePlatform: boolean;
    websites: ReadonlyArray<{ id: string }>;
  }) => (
    <button
      data-platform={String(canManagePlatform)}
      data-websites={websites.map((website) => website.id).join(',')}
    >
      Manage
    </button>
  ),
}));

const identity = {
  id: 'person',
  name: 'Ada',
  email: 'ada@example.org',
  emailVerified: true,
  createdAt: new Date('2026-10-29T00:00:00Z'),
  isPlatformAdmin: true,
};
const shared = {
  selfId: 'actor',
  canManage: true,
  canManagePlatform: false,
  sort: { field: 'name' as const, direction: 'asc' as const },
  sortHref: () => '/users',
  total: 1,
  isFiltered: false,
  resetHref: '/users',
};
const websites = [
  { id: 'one', name: 'Website One' },
  { id: 'two', name: 'Website Two' },
];

describe('shared user table', () => {
  it('shows website memberships, platform marker, and only manageable editor targets globally', async () => {
    render(
      await UsersTable({
        ...shared,
        scope: 'global',
        users: [{ ...identity, memberships: [{ tenantId: 'one', roles: ['viewer'] }] }],
        websites,
        manageableTenantIds: ['one'],
      }),
    );
    expect(screen.getByText('Website One')).toBeInTheDocument();
    expect(screen.queryByText('Website Two')).not.toBeInTheDocument();
    expect(screen.getByText('users.roles.platformAdmin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage' })).toHaveAttribute(
      'data-platform',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Manage' })).toHaveAttribute('data-websites', 'one');
    expect(screen.getAllByRole('table')).toHaveLength(1);
  });

  it('uses the same row and editor for one website without offering platform changes', async () => {
    render(
      await UsersTable({
        ...shared,
        scope: 'website',
        users: [{ ...identity, memberships: [{ tenantId: 'one', roles: ['editor'] }] }],
        websites: websites.slice(0, 1),
        manageableTenantIds: ['one'],
        canManagePlatform: true,
      }),
    );
    expect(screen.getByText('users.roles.editor')).toBeInTheDocument();
    expect(screen.getByText('users.roles.platformAdmin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage' })).toHaveAttribute(
      'data-platform',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Manage' })).toHaveAttribute('data-websites', 'one');
    expect(screen.getAllByRole('table')).toHaveLength(1);
  });

  it('marks the current person and does not expose self-service privilege controls', async () => {
    render(
      await UsersTable({
        ...shared,
        selfId: 'person',
        scope: 'website',
        users: [{ ...identity, memberships: [{ tenantId: 'one', roles: ['admin'] }] }],
        websites: websites.slice(0, 1),
        manageableTenantIds: ['one'],
      }),
    );
    expect(screen.getByText('users.table.you')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage' })).not.toBeInTheDocument();
  });

  it('keeps a website row to one line and opens the remaining roles in its details', async () => {
    render(
      await UsersTable({
        ...shared,
        scope: 'website',
        users: [
          {
            ...identity,
            memberships: [{ tenantId: 'one', roles: ['admin', 'editor', 'viewer', 'employee'] }],
          },
        ],
        websites: websites.slice(0, 1),
        manageableTenantIds: ['one'],
      }),
    );
    expect(screen.getByText('users.roles.admin')).toBeInTheDocument();
    expect(screen.getByText('users.roles.editor')).toBeInTheDocument();
    expect(screen.queryByText('users.roles.viewer')).not.toBeInTheDocument();
    expect(screen.queryByText('users.table.accessDetails')).not.toBeInTheDocument();
    expect(screen.queryByText('Website One')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'users.table.moreRoles' }));
    expect(screen.getByText('users.roles.viewer')).toBeInTheDocument();
    expect(screen.getByText('users.roles.employee')).toBeInTheDocument();
  });

  it('offers to reset the filters when nobody matches them', async () => {
    render(
      await UsersTable({
        ...shared,
        scope: 'website',
        users: [],
        total: 0,
        websites: websites.slice(0, 1),
        manageableTenantIds: ['one'],
        isFiltered: true,
        inviteHref: '/users/invite',
      }),
    );
    expect(screen.getByText('users.table.noMatch')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'users.filters.reset' })).toHaveAttribute(
      'href',
      '/users',
    );
    expect(screen.queryByRole('link', { name: 'users.invite.action' })).not.toBeInTheDocument();
  });

  it('offers the invitation when the list is empty without filters', async () => {
    render(
      await UsersTable({
        ...shared,
        scope: 'website',
        users: [],
        total: 0,
        websites: websites.slice(0, 1),
        manageableTenantIds: ['one'],
        inviteHref: '/users/invite',
      }),
    );
    expect(screen.getByText('users.table.empty')).toBeInTheDocument();
    expect(screen.queryByText('users.table.noMatch')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'users.invite.action' })).toHaveAttribute(
      'href',
      '/users/invite',
    );
  });
});
