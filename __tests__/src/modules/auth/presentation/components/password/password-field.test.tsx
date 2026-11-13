import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { PasswordField } from '@modules/auth/presentation/components/password/password-field';
import enAuth from '@modules/auth/presentation/i18n/en.json';

describe('auth-owned password field text', () => {
  it('shows and hides a password using only the auth namespace', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ auth: enAuth.auth }} timeZone="UTC">
        <PasswordField id="password" label="Password" defaultValue="private" />
      </NextIntlClientProvider>,
    );
    const input = screen.getByLabelText('Password');
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(input).toHaveAttribute('type', 'password');
    fireEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'password');
  });
});
