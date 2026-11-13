import type { ComponentProps, ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { inviteUserAction } from '@modules/auth/presentation/actions/invite-user-action';
import { InviteUserForm } from '@modules/auth/presentation/components/users/invite-user-form.client';
import en from '@modules/auth/presentation/i18n/en.json';

import app from '@i18n/messages/en.json';

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('@i18n', () => ({
  Link: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
  useRouter: () => navigation,
  usePathname: () => '/websites/site-1/users/invite',
}));
vi.mock('@modules/auth/presentation/actions/invite-user-action', () => ({
  inviteUserAction: vi.fn(),
}));

function Intl({ children }: { readonly children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={{ ...en, app }} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

const website = {
  listHref: '/websites/site-1/users',
  initialRole: 'viewer' as const,
  initialTenantId: 'site-1',
};

beforeEach(() => vi.clearAllMocks());

describe('invite wizard', () => {
  it('walks a website invitation through person, access and review, then returns to the list', async () => {
    vi.mocked(inviteUserAction).mockResolvedValue({ ok: true, data: undefined });
    const { rerender } = render(<InviteUserForm {...website} step="person" />, { wrapper: Intl });
    fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), {
      target: { value: 'ada@example.org' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next: Access' }));
    await waitFor(() => {
      expect(navigation.push).toHaveBeenLastCalledWith('/websites/site-1/users/invite?step=access');
    });

    rerender(<InviteUserForm {...website} step="access" />);
    expect(screen.getByRole('combobox', { name: 'Role' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Invite to' })).not.toBeInTheDocument();

    rerender(<InviteUserForm {...website} step="review" />);
    expect(screen.getByText('ada@example.org')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
    expect(inviteUserAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/websites/site-1/users?invited=1');
    });
    expect(inviteUserAction).toHaveBeenCalledTimes(1);

    rerender(<InviteUserForm {...website} step="person" />);
    expect(screen.getByRole('textbox', { name: 'Email address' })).toHaveValue('');
  });

  it('stays on the first step while the address is invalid', async () => {
    render(<InviteUserForm {...website} step="person" />, { wrapper: Intl });
    fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), {
      target: { value: 'not-an-address' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next: Access' }));
    expect(await screen.findByText(en.auth.validation.emailInvalid)).toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('reports an existing invitation on the review step without losing the entries', async () => {
    vi.mocked(inviteUserAction).mockResolvedValue({
      ok: false,
      error: { code: 'auth.invitation_pending', message: 'Pending' },
    });
    const { rerender } = render(<InviteUserForm {...website} step="person" />, { wrapper: Intl });
    fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), {
      target: { value: 'ada@example.org' },
    });
    rerender(<InviteUserForm {...website} step="review" />);
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    expect(await screen.findByText(en.auth.errors.invitationPending)).toBeInTheDocument();
    expect(screen.getByText('ada@example.org')).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('offers only websites as targets when the person may not invite platform administrators', () => {
    render(
      <InviteUserForm
        step="access"
        listHref="/websites/users"
        initialRole="viewer"
        websites={[{ id: 'site-1', name: 'Town' }]}
      />,
      { wrapper: Intl },
    );
    const target = screen.getByRole('combobox', { name: 'Invite to' });
    expect(target).toHaveTextContent('Choose a website');
    expect(target).not.toHaveTextContent('platform');
  });

  it('shows guidance for website or platform before a target is chosen', () => {
    render(
      <InviteUserForm
        step="access"
        listHref="/websites/users"
        initialRole="viewer"
        websites={[{ id: 'site-1', name: 'Town' }]}
        canInvitePlatformAdmin
      />,
      { wrapper: Intl },
    );
    expect(screen.getByRole('combobox', { name: 'Invite to' })).toHaveTextContent(
      'Choose a website or platform',
    );
  });
});
