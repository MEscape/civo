import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import InvitePage from '@/app/[locale]/(protected)/websites/[websiteId]/users/invite/page';

import { resolveServerComponents } from '../../../../../../../support/server-components';

const state = vi.hoisted(() => ({ mayManage: true }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('@modules/website', async () => import('@modules/website/presentation/routes'));
vi.mock('@/app/_lib/website-access', () => ({
  getWebsiteAccess: async () => ({ may: () => state.mayManage }),
}));
vi.mock('@modules/auth', () => ({
  isAuthEnabled: true,
  InviteUserAdministration: ({
    scope,
    listHref,
  }: {
    scope: { kind: string; websiteId: string };
    listHref: string;
  }) => (
    <p>
      {scope.kind} {scope.websiteId} {listHref}
    </p>
  ),
}));
const props = {
  params: Promise.resolve({ locale: 'en', websiteId: 'site-1' }),
  searchParams: Promise.resolve({}),
};

describe('website invite route', () => {
  it('invites into the open website and returns to its people', async () => {
    state.mayManage = true;
    render(await resolveServerComponents(InvitePage(props)));
    expect(screen.getByText('website site-1 /websites/site-1/users')).toBeInTheDocument();
  });

  it('answers "not found" to someone who may not manage people here', async () => {
    state.mayManage = false;
    await expect(resolveServerComponents(InvitePage(props))).rejects.toThrow('not-found');
  });
});
