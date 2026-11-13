import type { ComponentProps } from 'react';

import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import type {
  WebsiteListReaders,
  WebsiteSummaryView,
} from '@modules/website/application/contracts/website-views';
import { WebsitesTable } from '@modules/website/presentation/components/websites-table';
import enWebsite from '@modules/website/presentation/i18n/en.json';
import { loadWebsitesAdministration } from '@modules/website/presentation/loaders/load-websites-administration';

import { unauthorizedError } from '@lib/errors';
import { toPage } from '@lib/pagination';
import { errAsync, okAsync } from '@lib/result';

vi.mock('@i18n/server', () => ({
  getTranslations: async () =>
    createTranslator({ locale: 'en', messages: enWebsite, namespace: 'website' }),
  getAppFormatters: async () => ({ dateTime: (date: Date) => date.toISOString() }),
}));
vi.mock('@i18n', () => ({
  Link: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('not-found');
  },
}));

const website: WebsiteSummaryView = {
  id: 'site-a',
  name: 'Example town',
  slug: 'example-town',
  description: 'Services for everyone',
  templateKey: 'municipal',
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-10-29T12:00:00Z'),
};

describe('website administration loading', () => {
  it('uses the query-resolved page size in every navigation link', async () => {
    const view = await loadWebsitesAdministration({
      locale: 'en',
      pathname: '/websites',
      searchParams: { page: '999', pageSize: '999' },
      queries: {
        listWebsites: {
          execute: () =>
            okAsync({
              ...toPage([website], 100, { page: 3, pageSize: 48 }),
              isWebsitesTruncated: false,
            }),
        },
      },
    });
    expect(view.websites.page).toBe(3);
    expect(view.hrefFor(1)).toBe('/websites?pageSize=48');
    expect(view.hrefFor(2)).toBe('/websites?page=2&pageSize=48');
  });

  it('ignores repeated address values instead of passing arrays to the query', async () => {
    let received: unknown;
    const queries: WebsiteListReaders = {
      listWebsites: {
        execute: (options) => {
          received = options;
          return okAsync({
            ...toPage([], 0, { page: 1, pageSize: 12 }),
            isWebsitesTruncated: false,
          });
        },
      },
    };
    await loadWebsitesAdministration({
      locale: 'en',
      pathname: '/websites',
      searchParams: { page: ['1', '2'] },
      queries,
    });
    expect(received).toEqual({ page: undefined });
  });

  it('does not turn a refused query into an empty list', async () => {
    await expect(
      loadWebsitesAdministration({
        locale: 'en',
        pathname: '/websites',
        searchParams: {},
        queries: {
          listWebsites: {
            execute: () => errAsync(unauthorizedError('auth.unauthenticated', 'Sign in')),
          },
        },
      }),
    ).rejects.toThrow('not-found');
  });
});

describe('websites responsive table', () => {
  it('shows the same dataset and one labelled way in per row', async () => {
    render(await WebsitesTable({ locale: 'en', websites: [website], total: 1 }));
    expect(screen.getByRole('table', { name: 'Accessible websites' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Example town' })).toHaveAttribute(
      'href',
      '/websites/site-a',
    );
    expect(screen.getByRole('link', { name: 'Manage Example town' })).toHaveAttribute(
      'href',
      '/websites/site-a',
    );
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.getByText('/example-town')).toBeInTheDocument();
    expect(screen.getByText(website.updatedAt.toISOString()).closest('time')).toHaveAttribute(
      'dateTime',
      website.updatedAt.toISOString(),
    );
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('adds the way into the website’s bookings to the row when the person works there too', async () => {
    render(
      await WebsitesTable({
        locale: 'en',
        websites: [website],
        total: 1,
        alsoOpen: (id) => ({ href: `/bookings/${id}`, label: 'Bookings' }),
      }),
    );

    expect(screen.getByRole('link', { name: 'Bookings Example town' })).toHaveAttribute(
      'href',
      '/bookings/site-a',
    );
    expect(screen.getByRole('link', { name: 'Manage Example town' })).toBeInTheDocument();
  });

  it('lists a website only worked in through bookings as a row with just that way in', async () => {
    render(
      await WebsitesTable({
        locale: 'en',
        websites: [website],
        total: 1,
        elsewhere: [
          {
            id: 'site-b',
            name: 'Beta town',
            link: { href: '/bookings/site-b', label: 'Bookings' },
          },
        ],
      }),
    );

    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('Beta town', { selector: 'span.font-medium' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Beta town' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bookings Beta town' })).toHaveAttribute(
      'href',
      '/bookings/site-b',
    );
    expect(screen.queryByRole('link', { name: 'Manage Beta town' })).not.toBeInTheDocument();
    expect(screen.getByText('2 websites')).toBeInTheDocument();
  });

  it('shows the translated empty state without an empty table', async () => {
    render(await WebsitesTable({ locale: 'en', websites: [], total: 0 }));
    expect(screen.getByText('No websites yet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('offers the first website from the empty state to someone who may create one', async () => {
    render(await WebsitesTable({ locale: 'en', websites: [], total: 0, canCreate: true }));
    expect(screen.getByRole('link', { name: 'Create a website' })).toHaveAttribute(
      'href',
      '/websites/new',
    );
  });
});
