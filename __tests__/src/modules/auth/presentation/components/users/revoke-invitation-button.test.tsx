import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { revokeInvitationAction } from '@modules/auth/presentation/actions/revoke-invitation-action';
import { RevokeInvitationButton } from '@modules/auth/presentation/components/users/revoke-invitation-button.client';
import en from '@modules/auth/presentation/i18n/en.json';

vi.mock('@modules/auth/presentation/actions/revoke-invitation-action', () => ({
  revokeInvitationAction: vi.fn(),
}));

function show() {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      <RevokeInvitationButton invitationId="inv-1" email="ada@example.org" tenantId="site-1" />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('withdrawing an invitation', () => {
  it('asks first and withdraws nothing when the question is cancelled', async () => {
    show();
    fireEvent.click(
      screen.getByRole('button', { name: 'Withdraw invitation for ada@example.org' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('ada@example.org');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(revokeInvitationAction).not.toHaveBeenCalled();
  });

  it('withdraws after confirmation and shows a refusal beside the row', async () => {
    vi.mocked(revokeInvitationAction).mockResolvedValue({
      ok: false,
      error: { code: 'auth.permission_denied', message: 'Forbidden' },
    });
    show();
    fireEvent.click(
      screen.getByRole('button', { name: 'Withdraw invitation for ada@example.org' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw' }));
    await waitFor(() => {
      expect(revokeInvitationAction).toHaveBeenCalledWith({
        invitationId: 'inv-1',
        tenantId: 'site-1',
      });
    });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
