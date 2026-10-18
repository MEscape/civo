import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { ResetPasswordForm } from '@modules/auth/presentation/components/reset-password-form';
import enAuth from '@modules/auth/presentation/i18n/en.json';

import enApp from '@/i18n/en.json';

vi.mock('@modules/auth/presentation/actions/reset-password-action', () => ({
  resetPasswordAction: vi.fn(),
}));

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ app: enApp, auth: enAuth.auth }} timeZone="UTC">
      <ResetPasswordForm token="token" />
    </NextIntlClientProvider>,
  );
}

const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

describe('choosing a new password', () => {
  it('tells a person how the password is doing while they type, before anything is submitted', () => {
    renderForm();
    expect(screen.getByText('Strength shows as you type.')).toBeInTheDocument();

    type('New password', 'short');
    expect(screen.getByText('Strength: Weak')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent(/At least 12 characters/);

    type('New password', 'correct horse battery staple');
    expect(screen.getByText('Strength: Strong')).toBeInTheDocument();
  });

  it('separates what is required from what is only recommended', () => {
    renderForm();
    type('New password', 'qwertzqwertz1');

    // The length is met; "not a common password" is advice, and is not met.
    const [length, common] = screen.getAllByRole('listitem');
    expect(length).toHaveTextContent(/At least 12 characters\s*Done\./);
    expect(common).toHaveTextContent(/Not a common password or pattern\s*Not done yet\./);
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByText('Recommended')).toBeInTheDocument();
  });

  it('ticks the repeat once both passwords are the same, and says when they are not', async () => {
    renderForm();
    type('New password', 'correct horse battery staple');
    type('Repeat new password', 'correct horse');
    fireEvent.blur(screen.getByLabelText('Repeat new password'));

    expect(await screen.findByText('The passwords do not match.')).toBeInTheDocument();
    expect(screen.queryByText('The passwords match')).not.toBeInTheDocument();

    type('Repeat new password', 'correct horse battery staple');
    expect(await screen.findByText('The passwords match')).toBeInTheDocument();
    expect(screen.queryByText('The passwords do not match.')).not.toBeInTheDocument();
  });
});
