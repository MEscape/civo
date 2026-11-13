import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ForgotPasswordPage, { generateMetadata } from '@/app/[locale]/(auth)/forgot-password/page';

const state = vi.hoisted(() => ({ enabled: true }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('@modules/auth', () => ({
  get isAuthEnabled() {
    return state.enabled;
  },
  ForgotPasswordForm: () => <p>Reset your password</p>,
}));
vi.mock('@i18n/server', () => ({ getTranslations: async () => (key: string) => key }));

describe('forgot password route', () => {
  it('offers the form only while authentication is enabled', () => {
    state.enabled = true;
    render(ForgotPasswordPage());
    expect(screen.getByText('Reset your password')).toBeInTheDocument();
    state.enabled = false;
    expect(() => ForgotPasswordPage()).toThrow('not-found');
  });

  it('builds locale-specific recovery metadata', async () => {
    expect(await generateMetadata({ params: Promise.resolve({ locale: 'de' }) })).toMatchObject({
      alternates: { canonical: expect.stringContaining('/de/forgot-password') },
    });
  });
});
