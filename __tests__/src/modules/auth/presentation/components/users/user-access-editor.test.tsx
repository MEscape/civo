import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { UserAccessEditor } from '@modules/auth/presentation/components/users/user-access-editor.client';
import enAuth from '@modules/auth/presentation/i18n/en.json';

vi.mock('@modules/auth/presentation/actions/grant-platform-admin-action', () => ({
  grantPlatformAdminAction: vi.fn(),
}));
vi.mock('@modules/auth/presentation/actions/revoke-platform-admin-action', () => ({
  revokePlatformAdminAction: vi.fn(),
}));
vi.mock('@modules/auth/presentation/actions/set-user-access-action', () => ({
  setUserAccessAction: vi.fn(),
}));
vi.mock('@modules/auth/presentation/actions/remove-user-access-action', () => ({
  removeUserAccessAction: vi.fn(),
}));

const props = {
  userId: 'person',
  userName: 'Ada',
  userEmail: 'ada@example.org',
  isPlatformAdmin: true,
  memberships: [{ tenantId: 'one', roles: ['viewer' as const] }],
  websites: [{ id: 'one', name: 'Website One' }],
};

describe('shared access editor capabilities', () => {
  it('shows authorized website roles without platform controls for a website manager', async () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ auth: enAuth.auth }} timeZone="UTC">
        <UserAccessEditor {...props} />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Manage access Ada' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Roles in Website One' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Viewer' })).toBeChecked();
    expect(
      screen.queryByRole('checkbox', { name: 'Platform administrator' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Website Two')).not.toBeInTheDocument();
  });

  it('offers platform role controls only when the server supplies that capability', async () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ auth: enAuth.auth }} timeZone="UTC">
        <UserAccessEditor {...props} canManagePlatform />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Manage access Ada' }));
    expect(await screen.findByRole('checkbox', { name: 'Platform administrator' })).toBeChecked();
    expect(screen.getByRole('group', { name: 'Roles in Website One' })).toBeInTheDocument();
  });

  it('links each website to its own people page only where the page supplies the links', async () => {
    const { rerender } = render(
      <NextIntlClientProvider locale="en" messages={{ auth: enAuth.auth }} timeZone="UTC">
        <UserAccessEditor {...props} websiteHrefs={{ one: '/websites/one/users' }} />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Manage access Ada' }));
    expect(
      await screen.findByRole('link', { name: 'Manage people on Website One' }),
    ).toHaveAttribute('href', expect.stringMatching(/\/websites\/one\/users$/));

    rerender(
      <NextIntlClientProvider locale="en" messages={{ auth: enAuth.auth }} timeZone="UTC">
        <UserAccessEditor {...props} />
      </NextIntlClientProvider>,
    );
    expect(
      screen.queryByRole('link', { name: 'Manage people on Website One' }),
    ).not.toBeInTheDocument();
  });

  it('limits the dialog to the open website and points to the global page for other websites', async () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ auth: enAuth.auth }} timeZone="UTC">
        <UserAccessEditor {...props} globalUsersHref="/websites/users" />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Manage access Ada' }));
    expect(
      await screen.findByText(enAuth.auth.users.access.websiteDescription),
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Add to a website' })).not.toBeInTheDocument();
    expect(screen.queryByText(enAuth.auth.users.access.nothingToAdd)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to all users' })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/websites\/users$/),
    );
  });

  it('offers adding another website across websites', async () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ auth: enAuth.auth }} timeZone="UTC">
        <UserAccessEditor
          {...props}
          websites={[...props.websites, { id: 'two', name: 'Website Two' }]}
        />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Manage access Ada' }));
    expect(await screen.findByRole('combobox', { name: 'Add to a website' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Go to all users' })).not.toBeInTheDocument();
  });
});
