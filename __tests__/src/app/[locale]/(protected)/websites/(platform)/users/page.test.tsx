import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import UsersPage, {
  generateMetadata,
} from '@/app/[locale]/(protected)/websites/(platform)/users/page';

import { resolveServerComponents } from '../../../../../../support/server-components';

const state = vi.hoisted(() => ({ enabled: true }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('@modules/website', async () => import('@modules/website/presentation/routes'));
vi.mock('@modules/auth', () => ({
  get isAuthEnabled() {
    return state.enabled;
  },
  UsersAdministration: ({
    pathname,
    scope,
  }: {
    pathname: string;
    scope: { kind: string; websiteUsersHref: (id: string) => string };
  }) => (
    <p>
      {pathname} {scope.kind} {scope.websiteUsersHref('site-1')}
    </p>
  ),
}));
vi.mock('@i18n/server', () => ({ getTranslations: async () => (key: string) => key }));
const props = { params: Promise.resolve({ locale: 'en' }), searchParams: Promise.resolve({}) };

describe('global users route', () => {
  it('delegates manageable reach to the auth screen', async () => {
    state.enabled = true;
    render(await resolveServerComponents(UsersPage(props)));
    expect(screen.getByText('/websites/users global /websites/site-1/users')).toBeInTheDocument();
  });

  it('hides account administration while auth is disabled', async () => {
    state.enabled = false;
    await expect(resolveServerComponents(UsersPage(props))).rejects.toThrow('not-found');
  });

  it('keeps user administration metadata private', async () => {
    expect(await generateMetadata(props)).toMatchObject({
      robots: { index: false, follow: false },
    });
  });
});
