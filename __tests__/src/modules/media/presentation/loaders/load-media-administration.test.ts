import { describe, expect, it, vi } from 'vitest';

import type { MediaReaders } from '@modules/media/application/contracts/media-views';
import { loadMediaAdministration } from '@modules/media/presentation/loaders/load-media-administration';

import { forbiddenError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('not-found');
  },
}));

const found = { items: [], page: 2, pageSize: 12, total: 30, pageCount: 3 };

function recording() {
  const received: unknown[] = [];
  const queries: MediaReaders = {
    listAssets: {
      execute: (websiteId, options) => {
        received.push({ websiteId, options });
        return okAsync(found);
      },
    },
  };
  return { received, queries };
}

describe('loadMediaAdministration', () => {
  it('asks for the named website and the page the address names, and builds page links', async () => {
    const { received, queries } = recording();

    const view = await loadMediaAdministration({
      websiteId: 'site-1',
      pathname: '/websites/site-1/media',
      searchParams: { page: '2', pageSize: ['5', '6'] },
      queries,
    });

    expect(received).toEqual([
      {
        websiteId: 'site-1',
        options: {
          page: '2',
          pageSize: undefined,
          search: undefined,
          visibility: undefined,
          sort: { field: 'uploaded', direction: 'desc' },
        },
      },
    ]);
    expect(view.assets).toBe(found);
    expect(view.hasFilters).toBe(false);
    expect(view.hrefFor(1)).toBe('/websites/site-1/media?pageSize=12');
    expect(view.hrefFor(3)).toBe('/websites/site-1/media?page=3&pageSize=12');
  });

  it('reads search, visibility and sort from the address, and every link keeps the others', async () => {
    const { received, queries } = recording();

    const view = await loadMediaAdministration({
      websiteId: 'site-1',
      pathname: '/m',
      searchParams: { q: '  town ', visibility: 'private', sort: 'name', page: '2' },
      queries,
    });

    expect(received[0]).toMatchObject({
      options: { search: 'town', visibility: 'private', sort: { field: 'name', direction: 'asc' } },
    });
    expect(view.hasFilters).toBe(true);
    expect(view.hrefFor(3)).toBe('/m?q=town&visibility=private&sort=name&page=3&pageSize=12');
    expect(view.sortHref('name')).toBe('/m?q=town&visibility=private&sort=-name&pageSize=12');
    expect(view.sortHref('uploaded')).toBe('/m?q=town&visibility=private&pageSize=12');
    expect(view.visibilityHref(null)).toBe('/m?q=town&sort=name&pageSize=12');
    expect(view.resetHref).toBe('/m?sort=name&pageSize=12');
  });

  it('ignores a sort or visibility it does not know instead of failing', async () => {
    const { received, queries } = recording();

    await loadMediaAdministration({
      websiteId: 'site-1',
      pathname: '/m',
      searchParams: { sort: 'objectKey', visibility: 'secret' },
      queries,
    });

    expect(received[0]).toMatchObject({
      options: { visibility: undefined, sort: { field: 'uploaded', direction: 'desc' } },
    });
  });

  it('shows "not found" to a person who may not read this website, disclosing nothing', async () => {
    const queries: MediaReaders = {
      listAssets: { execute: () => errAsync(forbiddenError('auth.permission_denied', 'no')) },
    };
    await expect(
      loadMediaAdministration({
        websiteId: 'site-1',
        pathname: '/p',
        searchParams: {},
        queries,
      }),
    ).rejects.toThrow('not-found');
  });
});
