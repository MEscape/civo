import { Pagination } from '@components/shared/pagination';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import type { Page } from '@lib/pagination';
import { buildQueryString } from '@lib/utils';

export interface HistoryPaginationProps {
  readonly locale: Locale;
  /** Which history the pages belong to; each has its own landmark name. */
  readonly scope: 'releases' | 'migrations';
  readonly page: Page<unknown>;
  /** The release screen's address; the page links add the part shown, `page` and `pageSize` to it. */
  readonly basePath: string;
}

/** The page links of a release or migration history; drawn only when there is more than one page. */
export async function HistoryPagination({ locale, scope, page, basePath }: HistoryPaginationProps) {
  if (page.pageCount <= 1) {
    return null;
  }
  const t = await getTranslations({
    locale,
    namespace:
      scope === 'releases' ? 'release.history.pagination' : 'release.migration.history.pagination',
  });
  const first = (page.page - 1) * page.pageSize + 1;

  return (
    <Pagination
      page={page.page}
      pageCount={page.pageCount}
      hrefFor={(target) =>
        `${basePath}${buildQueryString({ tab: scope === 'migrations' ? 'updates' : undefined, page: target === 1 ? undefined : target, pageSize: page.pageSize })}`
      }
      labels={{
        nav: t('nav'),
        previous: t('previous'),
        next: t('next'),
        summary: t('summary', {
          first,
          last: first + page.items.length - 1,
          total: page.total,
        }),
        pageLabel: (target) => t('page', { page: target }),
      }}
    />
  );
}
