import { describe, expect, it, vi } from 'vitest';

import { loadBuilderPages } from '@modules/builder/presentation/loaders/load-builder-pages';
import type { BuilderPagesReaders } from '@modules/builder/presentation/loaders/load-builder-pages';

import { forbiddenError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('not-found');
  },
}));

const item = {
  id: 'p1',
  websiteId: 'site-1',
  path: 'about',
  title: 'About',
  version: 3,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-02-01T00:00:00Z'),
  outline: null,
};
const found = { items: [item], page: 2, pageSize: 25, total: 60, pageCount: 3 };

describe('loadBuilderPages', () => {
  it('asks for the named website and the slice the address names, as JSON-safe items', async () => {
    let received: unknown;
    const queries: BuilderPagesReaders = {
      listPages: {
        execute: (input) => {
          received = input;
          return okAsync(found);
        },
      },
    };

    const view = await loadBuilderPages({
      websiteId: 'site-1',
      pathname: '/websites/site-1/builder',
      searchParams: { page: '2', pageSize: ['5', '6'] },
      queries,
    });

    expect(received).toEqual({ websiteId: 'site-1', page: '2', pageSize: undefined });
    expect(view.pages.items[0]?.updatedAt).toBe('2026-02-01T00:00:00.000Z');
    expect(view.hrefFor(1)).toBe('/websites/site-1/builder?pageSize=25');
    expect(view.hrefFor(3)).toBe('/websites/site-1/builder?page=3&pageSize=25');
  });

  it('shows "not found" to a person who may not read this website, disclosing nothing', async () => {
    const queries: BuilderPagesReaders = {
      listPages: { execute: () => errAsync(forbiddenError('auth.permission_denied', 'no')) },
    };

    await expect(
      loadBuilderPages({ websiteId: 'site-1', pathname: '/p', searchParams: {}, queries }),
    ).rejects.toThrow('not-found');
  });
});
