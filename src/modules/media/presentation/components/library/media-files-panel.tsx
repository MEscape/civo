import { DataPanel } from '@components/shared/data-panel';
import { Pagination } from '@components/shared/pagination';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { MediaFilesTable } from './media-files-table';
import { MediaFilters } from './media-filters';

import type { MediaAdministrationView } from '../../loaders/load-media-administration';
import type { MediaUses } from '../../loaders/load-media-usage';

interface MediaFilesPanelProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly pathname: string;
  readonly view: MediaAdministrationView;
  readonly usage: MediaUses;
  readonly mayDelete: boolean;
  readonly canUpload: boolean;
}

/**
 * The website's files in the shared list frame: the total, the visibility chips and the search
 * (once there is something to search), the table, and the pages when there is more than one.
 */
export async function MediaFilesPanel({
  locale,
  websiteId,
  pathname,
  view,
  usage,
  mayDelete,
  canUpload,
}: MediaFilesPanelProps) {
  const t = await getTranslations({ locale, namespace: 'media' });
  const { assets, filters } = view;

  return (
    <DataPanel
      title={t('library.panelTitle')}
      meta={t('library.count', { count: assets.total })}
      footer={
        assets.pageCount > 1 ? (
          <Pagination
            locale={locale}
            slice={assets}
            hrefFor={view.hrefFor}
            label={t('library.paginationNav')}
          />
        ) : undefined
      }
    >
      {(assets.total > 0 || view.hasFilters) && (
        <MediaFilters
          pathname={pathname}
          text={filters.text}
          visibility={filters.visibility}
          sort={filters.sort}
          visibilityHref={view.visibilityHref}
          resetHref={view.resetHref}
        />
      )}
      <MediaFilesTable
        websiteId={websiteId}
        assets={assets.items}
        mayDelete={mayDelete}
        canUpload={canUpload}
        usage={usage}
        sort={filters.sort}
        sortHref={view.sortHref}
        resetHref={view.hasFilters ? view.resetHref : null}
      />
    </DataPanel>
  );
}
