// @ui-plain pagination WebsitesTable frames the list in a DataPanel and draws these page links in its footer.
import { I18nProvider } from '@components/providers/i18n-provider';
import { Pagination } from '@components/shared/pagination';
import { Alert } from '@components/ui/alert';

import type { Locale } from '@i18n';

import { getWebsiteQueries } from '../../composition';
import { loadWebsitesAdministration } from '../loaders/load-websites-administration';

import { WebsitesTable } from './websites-table';

import type { ElsewhereWebsite, WebsiteRowLink } from './website-columns';

interface WebsitesAdministrationProps {
  readonly locale: Locale;
  readonly pathname: string;
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
  /** Display only (the empty state's call to action); creation still authorizes in the command. */
  readonly canCreate: boolean;
  /** The website's bookings, for the websites the person also works in through them. */
  readonly alsoOpen?: ((websiteId: string) => WebsiteRowLink | undefined) | undefined;
  /** Websites the person works in only through another area (an employee's bookings): after the websites, on the first page. */
  readonly elsewhere?: readonly ElsewhereWebsite[];
}

/** Route pages mount this screen; its loader owns address parsing and data loading, like auth and audit. */
export async function WebsitesAdministration({
  locale,
  pathname,
  searchParams,
  canCreate,
  alsoOpen,
  elsewhere,
}: WebsitesAdministrationProps) {
  const { websites, t, hrefFor } = await loadWebsitesAdministration({
    locale,
    pathname,
    searchParams,
    queries: getWebsiteQueries(),
  });
  return (
    <I18nProvider locale={locale} namespaces={['website']}>
      <div className="space-y-6">
        {websites.isWebsitesTruncated && (
          <Alert variant="warning" role="status">
            {t('pages.list.truncated')}
          </Alert>
        )}
        <WebsitesTable
          locale={locale}
          websites={websites.items}
          total={websites.total}
          canCreate={canCreate}
          alsoOpen={alsoOpen}
          elsewhere={websites.page === 1 ? elsewhere : undefined}
          pagination={
            websites.pageCount > 1 ? (
              <Pagination
                locale={locale}
                slice={websites}
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
