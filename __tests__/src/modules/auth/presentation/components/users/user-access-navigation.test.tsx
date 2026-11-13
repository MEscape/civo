import type { ComponentProps } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { UserAccessEditor } from '@modules/auth/presentation/components/users/user-access-editor.client';
import en from '@modules/auth/presentation/i18n/en.json';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@i18n', () => ({
  Link: ({ href, children, ...props }: ComponentProps<'a'>) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  ),
}));
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

describe('access dialog navigation', () => {
  it('keeps edits when navigation is cancelled and follows the website link only after explicit discard', async () => {
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        <UserAccessEditor
          userId="person"
          userName="Ada"
          userEmail="ada@example.org"
          isPlatformAdmin={false}
          memberships={[{ tenantId: 'one', roles: ['viewer'] }]}
          websites={[{ id: 'one', name: 'Town' }]}
          websiteHrefs={{ one: '/websites/one/users' }}
        />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Manage access Ada' }));
    await screen.findByRole('dialog');
    const editor = screen.getByRole('checkbox', { name: 'Editor' });
    fireEvent.click(editor);
    const link = screen.getByRole('link', { name: 'Manage people on Town' });
    fireEvent.click(link);
    await screen.findByRole('alertdialog', { name: 'Discard access changes?' });
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(editor).toBeChecked();
    fireEvent.click(link);
    fireEvent.click(await screen.findByRole('button', { name: 'Discard changes' }));
    expect(navigate).toHaveBeenCalledWith('/websites/one/users');
  });
});
