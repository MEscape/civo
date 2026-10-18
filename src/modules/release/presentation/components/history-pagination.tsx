import { ListPagination } from '@components/shared/list-pagination';

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

/** The page links of a release or migration history; render it only when there is more than one page. */
export async function HistoryPagination({ locale, scope, page, basePath }: HistoryPaginationProps) {
  const t = await getTranslations({
    locale,
    namespace:
      scope === 'releases' ? 'release.history.pagination' : 'release.migration.history.pagination',
  });

  return (
    <ListPagination
      locale={locale}
      slice={page}
      hrefFor={(target) =>
        `${basePath}${buildQueryString({ tab: scope === 'migrations' ? 'updates' : undefined, page: target === 1 ? undefined : target, pageSize: page.pageSize })}`
      }
      label={t('nav')}
    />
  );
}
