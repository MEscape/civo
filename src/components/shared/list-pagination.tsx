import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import type { Page } from '@lib/pagination';

import { Pagination } from './pagination';

export interface ListPaginationProps {
  /** The URL's locale: a page prerenders on its own, so it must not be read from the request. */
  readonly locale: Locale;
  /** The slice of the list on screen. */
  readonly slice: Page<unknown>;
  /** The address of a page, keeping the list's filters. */
  readonly hrefFor: (page: number) => string;
  /** Names the landmark, e.g. "Users pages": several lists can share a screen. */
  readonly label: string;
}

/**
 * The page links of a list, worded the same on every list: drawn only when
 * there is more than one page, with "26–50 of 120" from the slice itself.
 * Put it in a `DataPanel`'s footer.
 */
export async function ListPagination({ locale, slice, hrefFor, label }: ListPaginationProps) {
  if (slice.pageCount <= 1) {
    return null;
  }
  const t = await getTranslations({ locale, namespace: 'app' });
  const first = (slice.page - 1) * slice.pageSize + 1;

  return (
    <Pagination
      page={slice.page}
      pageCount={slice.pageCount}
      hrefFor={hrefFor}
      labels={{
        nav: label,
        previous: t('pagination.previous'),
        next: t('pagination.next'),
        summary: t('pagination.summary', {
          first,
          last: first + slice.items.length - 1,
          total: slice.total,
        }),
        pageLabel: (target) => t('pagination.page', { page: target }),
      }}
    />
  );
}
