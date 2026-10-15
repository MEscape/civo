import { describe, expect, it } from 'vitest';

import {
  clampToLastPage,
  formatSort,
  loadClampedPage,
  offsetOf,
  pageCountOf,
  resolvePageRequest,
  resolveSort,
  toPage,
} from '@lib/pagination';
import type { Page, PageRequest } from '@lib/pagination';
import { okAsync } from '@lib/result';

describe('resolvePageRequest', () => {
  it('reads the page and size from query text', () => {
    expect(resolvePageRequest({ page: '3', pageSize: '50' })).toEqual({ page: 3, pageSize: 50 });
  });

  it.each([undefined, '', 'abc', '0', '-2', '1.5', NaN, [], {}])(
    'falls back to the first page and default size for %j',
    (junk) => {
      expect(resolvePageRequest({ page: junk, pageSize: junk })).toEqual({ page: 1, pageSize: 25 });
    },
  );

  it.each(['99999999999999999999', '1e300', String(Number.MAX_SAFE_INTEGER + 2)])(
    'falls back to the first page for %s, which no offset can express',
    (huge) => {
      expect(resolvePageRequest({ page: huge }).page).toBe(1);
    },
  );

  it('never lets a request exceed the size limit', () => {
    expect(resolvePageRequest({ pageSize: '100000' })).toEqual({ page: 1, pageSize: 100 });
    expect(
      resolvePageRequest({ pageSize: 80 }, { defaultPageSize: 10, maxPageSize: 20 }).pageSize,
    ).toBe(20);
  });
});

describe('paging arithmetic', () => {
  it('skips the pages before the requested one', () => {
    expect(offsetOf({ page: 3, pageSize: 25 })).toBe(50);
  });

  it('counts pages, and an empty list still has one', () => {
    expect(pageCountOf(0, 25)).toBe(1);
    expect(pageCountOf(25, 25)).toBe(1);
    expect(pageCountOf(26, 25)).toBe(2);
  });

  it('describes a page for a control to draw', () => {
    expect(toPage(['a'], 51, { page: 3, pageSize: 25 })).toEqual({
      items: ['a'],
      page: 3,
      pageSize: 25,
      total: 51,
      pageCount: 3,
    });
  });

  it('moves a request past the end back onto the last page', () => {
    expect(clampToLastPage({ page: 9, pageSize: 10 }, 25)).toEqual({ page: 3, pageSize: 10 });
    expect(clampToLastPage({ page: 2, pageSize: 10 }, 25)).toEqual({ page: 2, pageSize: 10 });
  });
});

describe('resolveSort', () => {
  const FIELDS = ['name', 'createdAt'] as const;
  const FALLBACK = { field: 'name', direction: 'asc' } as const;

  it('reads a field and a descending prefix', () => {
    expect(resolveSort('-createdAt', FIELDS, FALLBACK)).toEqual({
      field: 'createdAt',
      direction: 'desc',
    });
    expect(formatSort({ field: 'createdAt', direction: 'desc' })).toBe('-createdAt');
  });

  it('accepts only fields from the allowlist', () => {
    expect(resolveSort('password; drop table', FIELDS, FALLBACK)).toBe(FALLBACK);
    expect(resolveSort(undefined, FIELDS, FALLBACK)).toBe(FALLBACK);
  });
});

describe('loadClampedPage', () => {
  const ITEMS = ['a', 'b', 'c', 'd', 'e'];

  /** A store of five items that also answers a field of its own beside the page. */
  function read(request: PageRequest) {
    const start = (request.page - 1) * request.pageSize;
    const items = ITEMS.slice(start, start + request.pageSize);
    return okAsync({ ...toPage(items, ITEMS.length, request), live: 'x' } satisfies Page<string> & {
      live: string;
    });
  }

  it('answers the page asked for, with the fields the read added', async () => {
    const result = await loadClampedPage({ page: 2, pageSize: 2 }, read);

    expect(result._unsafeUnwrap()).toMatchObject({ page: 2, items: ['c', 'd'], live: 'x' });
  });

  it('answers the last page when the address points past the end', async () => {
    const result = await loadClampedPage({ page: 9, pageSize: 2 }, read);

    expect(result._unsafeUnwrap()).toMatchObject({ page: 3, items: ['e'], total: 5, live: 'x' });
  });
});
