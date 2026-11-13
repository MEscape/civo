import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { infrastructureError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import AcceptInvitationPage, {
  generateMetadata,
} from '@/app/[locale]/(auth)/accept-invitation/page';

import { resolveServerComponents } from '../../../../support/server-components';

const state = vi.hoisted(() => ({ enabled: true, preview: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('next/server', () => ({ connection: async () => undefined }));
vi.mock('@modules/auth', async () => ({
  ...(await import('@modules/auth/presentation/schemas/page-params-schema')),
  get isAuthEnabled() {
    return state.enabled;
  },
  getAuthQueries: () => ({ previewInvitation: { execute: state.preview } }),
  authRoutes: { signIn: () => '/sign-in' },
  InvitationLinkMissing: () => <p>Invitation link missing</p>,
  InvitationLinkInvalid: () => <p>Invitation no longer available</p>,
  AcceptInvitationForm: ({
    token,
    invitation,
  }: {
    token: string;
    invitation: { email: string; expiresAt: string };
  }) => (
    <p>
      {token} {invitation.email} {invitation.expiresAt}
    </p>
  ),
}));
vi.mock('@i18n/server', () => ({
  getTranslations: async () => (key: string) => key,
  getLocale: async () => 'en',
}));
beforeEach(() => {
  state.enabled = true;
  state.preview.mockReset();
});
const params = Promise.resolve({ locale: 'en' });
const props = (searchParams: Record<string, string | string[]> = {}) => ({
  params,
  searchParams: Promise.resolve(searchParams),
});

describe('accept invitation route', () => {
  it('does not read the database for a missing invitation token', async () => {
    render(await resolveServerComponents(AcceptInvitationPage(props())));
    expect(screen.getByText('Invitation link missing')).toBeInTheDocument();
    expect(state.preview).not.toHaveBeenCalled();
  });

  it('shows an invalid-link state for an already used or expired invitation', async () => {
    state.preview.mockReturnValue(okAsync(null));
    render(await resolveServerComponents(AcceptInvitationPage(props({ token: 'valid-token' }))));
    expect(screen.getByText('Invitation no longer available')).toBeInTheDocument();
  });

  it('passes the authorized preview to the form with a serializable expiry', async () => {
    state.preview.mockReturnValue(
      okAsync({
        email: 'person@example.org',
        role: 'editor',
        organisation: 'Town',
        expiresAt: new Date('2026-10-30T12:00:00Z'),
        invitedBy: 'Administrator',
        requiresExistingAccount: true,
        canAcceptExistingAccount: false,
      }),
    );
    render(await resolveServerComponents(AcceptInvitationPage(props({ token: 'valid-token' }))));
    expect(
      screen.getByText('valid-token person@example.org 2026-10-30T12:00:00.000Z'),
    ).toBeInTheDocument();
  });

  it('propagates infrastructure failure instead of describing a valid invitation as invalid', async () => {
    const failure = infrastructureError('auth.invitation_failed', 'Unavailable');
    state.preview.mockReturnValue(errAsync(failure));
    await expect(
      resolveServerComponents(AcceptInvitationPage(props({ token: 'valid-token' }))),
    ).rejects.toMatchObject({ cause: failure });
  });

  it('hides the route when authentication is disabled and keeps metadata private', async () => {
    state.enabled = false;
    expect(() => AcceptInvitationPage(props())).toThrow('not-found');
    expect(await generateMetadata(props())).toMatchObject({
      robots: { index: false, follow: false },
    });
  });
});
