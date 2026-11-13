import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EmailVerificationResult } from '@modules/auth/presentation/components/verification/email-verification-result';
import { resolveReturnPath } from '@modules/auth/presentation/navigation/return-path';
import { parseEmailVerifiedPageParams } from '@modules/auth/presentation/schemas/page-params-schema';

vi.mock('@i18n/server', () => ({ getTranslations: async () => (key: string) => key }));
vi.mock('@i18n', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('invitation reentry after verification', () => {
  it('returns sign-in to the original acceptance page without granting access', async () => {
    const params = parseEmailVerifiedPageParams({ token: 'Invitation_Token-123' });
    render(await EmailVerificationResult(params));
    const href = screen
      .getByRole('link', { name: 'emailVerification.signIn' })
      .getAttribute('href');
    const signIn = new URL(href ?? '', 'https://example.org');
    expect(signIn.pathname).toBe('/sign-in');
    expect(resolveReturnPath(signIn.searchParams.get('returnTo') ?? undefined)).toBe(
      '/accept-invitation?token=Invitation_Token-123',
    );
  });

  it.each(['//foreign.example/path', ' token ', 'x'.repeat(513), ['one', 'two']])(
    'drops malformed or repeated invitation context',
    async (token) => {
      const params = parseEmailVerifiedPageParams({ token });
      expect(params.invitationToken).toBeUndefined();
      render(await EmailVerificationResult(params));
      expect(screen.getByRole('link', { name: 'emailVerification.signIn' })).toHaveAttribute(
        'href',
        '/sign-in',
      );
    },
  );
});
