import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import EmailVerifiedPage, { generateMetadata } from '@/app/[locale]/(auth)/email-verified/page';

import { resolveServerComponents } from '../../../../support/server-components';

vi.mock('@modules/auth', async () => ({
  ...(await import('@modules/auth/presentation/schemas/page-params-schema')),
  isAuthEnabled: true,
  EmailVerificationResult: ({
    hasFailed,
    invitationToken,
  }: {
    hasFailed: boolean;
    invitationToken?: string;
  }) => (
    <p>
      {hasFailed ? 'Failed' : 'Verified'} {invitationToken ?? 'No invitation'}
    </p>
  ),
}));
vi.mock('@i18n/server', () => ({ getTranslations: async () => (key: string) => key }));
const params = Promise.resolve({ locale: 'en' });

describe('email verification route', () => {
  it.each([
    { search: {}, text: 'Verified No invitation' },
    { search: { error: 'expired', token: 'invite-token' }, text: 'Failed invite-token' },
    { search: { token: 'bad/token' }, text: 'Verified No invitation' },
  ])('renders $text from validated redirect parameters', async ({ search, text }) => {
    render(
      await resolveServerComponents(
        EmailVerifiedPage({ params, searchParams: Promise.resolve(search) }),
      ),
    );
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('keeps verification outcomes out of search indexes', async () => {
    expect(await generateMetadata({ params, searchParams: Promise.resolve({}) })).toMatchObject({
      robots: { index: false, follow: false },
    });
  });
});
