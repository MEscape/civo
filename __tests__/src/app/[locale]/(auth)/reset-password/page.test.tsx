import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ResetPasswordPage, { generateMetadata } from '@/app/[locale]/(auth)/reset-password/page';

import { resolveServerComponents } from '../../../../support/server-components';

const state = vi.hoisted(() => ({ enabled: true }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('@modules/auth', async () => ({
  ...(await import('@modules/auth/presentation/schemas/page-params-schema')),
  get isAuthEnabled() {
    return state.enabled;
  },
  ResetPasswordForm: ({ token }: { token: string }) => <p>Reset using {token}</p>,
  ResetPasswordLinkMissing: () => <p>Reset link missing</p>,
}));
vi.mock('@i18n/server', () => ({ getTranslations: async () => (key: string) => key }));
beforeEach(() => {
  state.enabled = true;
});
const params = Promise.resolve({ locale: 'en' });

describe('reset password route', () => {
  it('passes a valid token to the form', async () => {
    render(
      await resolveServerComponents(
        ResetPasswordPage({ params, searchParams: Promise.resolve({ token: 'valid-token' }) }),
      ),
    );
    expect(screen.getByText('Reset using valid-token')).toBeInTheDocument();
  });

  it.each([{}, { token: ['first', 'second'] }])(
    'shows the missing-link state for untrusted parameters %j',
    async (searchParams) => {
      render(
        await resolveServerComponents(
          ResetPasswordPage({ params, searchParams: Promise.resolve(searchParams) }),
        ),
      );
      expect(screen.getByText('Reset link missing')).toBeInTheDocument();
    },
  );

  it('does not offer password reset when authentication is disabled', () => {
    state.enabled = false;
    expect(() => ResetPasswordPage({ params, searchParams: Promise.resolve({}) })).toThrow(
      'not-found',
    );
  });

  it('keeps single-use reset URLs out of search indexes', async () => {
    expect(await generateMetadata({ params, searchParams: Promise.resolve({}) })).toMatchObject({
      robots: { index: false, follow: false },
    });
  });
});
