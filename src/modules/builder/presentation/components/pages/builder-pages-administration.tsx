// @ui-plain pagination PageList frames the list in a DataPanel and draws these page links in its footer.
import { I18nProvider } from '@components/providers/i18n-provider';
import { Pagination } from '@components/shared/pagination';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getBuilderQueries } from '../../../composition';
import { loadBuilderPages } from '../../loaders/load-builder-pages';

import { PageList } from './page-list';

interface BuilderPagesAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  /** The page address without its query: pages are links back to it. */
  readonly pathname: string;
  /** The raw query of the request; parsed here, never trusted. */
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
  /** Display only (the empty state's call to action); the server still authorizes. */
  readonly canCreate: boolean;
}

/**
 * The page list of one website; a new page is made in its own wizard. Route pages mount this;
 * the loader owns address parsing and data loading, like auth, audit and media.
 */
export async function BuilderPagesAdministration({
  locale,
  websiteId,
  pathname,
  searchParams,
  canCreate,
}: BuilderPagesAdministrationProps) {
  const [{ pages, hrefFor }, t] = await Promise.all([
    loadBuilderPages({ websiteId, pathname, searchParams, queries: getBuilderQueries() }),
    getTranslations({ locale, namespace: 'builder' }),
  ]);

  return (
    <I18nProvider locale={locale} namespaces={['builder']}>
      <div className="space-y-6">
        <PageList
          locale={locale}
          websiteId={websiteId}
          pages={pages.items}
          total={pages.total}
          canCreate={canCreate}
          pagination={
            pages.pageCount > 1 ? (
              <Pagination
                locale={locale}
                slice={pages}
                hrefFor={hrefFor}
                label={t('pages.list.paginationNav')}
              />
            ) : undefined
          }
        />
      </div>
    </I18nProvider>
  );
}
