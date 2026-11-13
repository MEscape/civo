import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import WebsitesPage, {
  generateMetadata,
} from '@/app/[locale]/(protected)/websites/(platform)/page';

import { resolveServerComponents } from '../../../../../support/server-components';

const state = vi.hoisted(() => ({
  canCreate: false,
  links: {
    landing: undefined as string | undefined,
    alsoOpen: () => undefined,
    elsewhere: [] as Array<{ id: string; name: string; link: { href: string; label: string } }>,
  },
  redirected: [] as string[],
}));
vi.mock('@modules/booking', () => ({ loadWebsiteListLinks: async () => state.links }));
vi.mock('@/app/_lib/website-access', () => ({
  getWebsiteAccess: async () => ({ may: () => state.canCreate }),
}));
vi.mock('@modules/website', async () => ({
  ...(await import('@modules/website/presentation/routes')),
  WebsitesAdministration: ({
    locale,
    pathname,
    canCreate,
    searchParams,
    elsewhere = [],
  }: {
    locale: string;
    pathname: string;
    canCreate: boolean;
    searchParams: Record<string, string>;
    elsewhere?: Array<{ name: string; link: { href: string } }>;
  }) => (
    <>
      <p>
        {locale} {pathname} {canCreate ? 'Create enabled' : 'Browse only'} {searchParams['page']}
      </p>
      {elsewhere.map(({ name, link }) => (
        <a key={name} href={link.href}>
          {name}
        </a>
      ))}
    </>
  ),
}));
vi.mock('@i18n/server', () => ({ getTranslations: async () => (key: string) => key }));
vi.mock('@i18n', async () => ({
  ...(await vi.importActual<object>('@i18n')),
  redirect: ({ href }: { href: string }) => {
    state.redirected.push(href);
    return null;
  },
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
const props = {
  params: Promise.resolve({ locale: 'de' }),
  searchParams: Promise.resolve({ page: '2' }),
};

const noLinks = { landing: undefined, alsoOpen: () => undefined, elsewhere: [] };

describe('website list route', () => {
  it.each([false, true])(
    'uses the same listing for members and platform administrators, with create=%s',
    async (canCreate) => {
      state.canCreate = canCreate;
      state.links = noLinks;
      render(await resolveServerComponents(WebsitesPage(props)));
      expect(
        screen.getByText(`de /websites ${canCreate ? 'Create enabled' : 'Browse only'} 2`),
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'pages.list.title' })).toBeInTheDocument();
      const create = screen.queryByRole('link', { name: 'pages.list.createTitle' });
      if (canCreate) {
        expect(create).toHaveAttribute('href', '/websites/new');
      } else {
        expect(create).not.toBeInTheDocument();
      }
    },
  );

  it('hands the websites only worked in through bookings to the list, as rows of it', async () => {
    state.canCreate = false;
    state.redirected = [];
    state.links = {
      ...noLinks,
      elsewhere: [{ id: 'b', name: 'Beta', link: { href: '/bookings/b', label: 'Bookings' } }],
    };
    render(await resolveServerComponents(WebsitesPage(props)));

    expect(screen.getByRole('link', { name: 'Beta' })).toHaveAttribute('href', '/bookings/b');
    expect(state.redirected).toEqual([]);
  });

  it('sends someone with no website to open to where the work is', async () => {
    state.redirected = [];
    state.links = { ...noLinks, landing: '/bookings/b' };
    await resolveServerComponents(WebsitesPage(props));

    expect(state.redirected).toEqual(['/bookings/b']);
  });

  it('keeps administration metadata private', async () => {
    expect(await generateMetadata(props)).toMatchObject({
      robots: { index: false, follow: false },
    });
  });
});
