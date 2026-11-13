import type { ComponentProps } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { signInAction } from '@modules/auth/presentation/actions/sign-in-action';
import { SignInForm } from '@modules/auth/presentation/components/sign-in/sign-in-form';
import en from '@modules/auth/presentation/i18n/en.json';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('@i18n', () => ({
  useRouter: () => ({ push }),
  Link: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));
vi.mock('@modules/auth/presentation/actions/sign-in-action', () => ({ signInAction: vi.fn() }));
beforeEach(() => {
  vi.mocked(signInAction).mockReset();
  push.mockClear();
});

function show(returnTo?: string) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      <SignInForm returnTo={returnTo} />
    </NextIntlClientProvider>,
  );
}
function fill() {
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'person@example.org' },
  });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'private-password' } });
}

describe('SignInForm', () => {
  it('uses the action-approved destination after successful authentication', async () => {
    vi.mocked(signInAction).mockResolvedValue({
      ok: true,
      data: { redirectTo: '/websites/site-1' },
    });
    show('/websites/site-1');
    expect(screen.getByRole('status')).toBeInTheDocument();
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/websites/site-1');
    });
    expect(signInAction).toHaveBeenCalledWith({
      email: 'person@example.org',
      password: 'private-password',
      returnTo: '/websites/site-1',
    });
  });

  it('clears a rejected password, preserves the email, and focuses the password for retry', async () => {
    vi.mocked(signInAction).mockResolvedValue({
      ok: false,
      error: { code: 'auth.credentials_invalid', message: 'Invalid credentials' },
    });
    show();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByLabelText('Password')).toHaveValue(''));
    expect(screen.getByLabelText('Email address')).toHaveValue('person@example.org');
    expect(screen.getByLabelText('Password')).toHaveFocus();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('refuses invalid local input without making an authentication request', async () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(signInAction).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});
