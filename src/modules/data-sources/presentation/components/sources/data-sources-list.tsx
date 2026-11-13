import { UploadCloud } from '@components/icons/icons';
import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel } from '@components/shared/data-panel';
import { Pagination } from '@components/shared/pagination';
import { ResponsiveTable } from '@components/shared/responsive-table';
import { Button } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { dataSourceRoutes } from '../../routes';

import { dataSourceColumns } from './data-source-columns';

import type { DataSourceRemoval } from './data-source-columns';
import type { DataSourceDto } from '../../dto/data-source-dto';

type PageSlice = Parameters<typeof Pagination>[0]['slice'];

interface DataSourcesListProps {
  readonly locale: Locale;
  readonly websiteId: string;
  /** The sources on this page of the list. */
  readonly sources: readonly DataSourceDto[];
  /** Every source of the website, not only this page. */
  readonly total: number;
  /** The pages of the list, and the address of each. */
  readonly slice: PageSlice;
  readonly hrefFor: (page: number) => string;
  /**
   * Whether the empty list offers connecting one: display only, the use case authorizes on its
   * own. Off while the setup guide is shown, which already leads there.
   */
  readonly mayCreate: boolean;
  /** Absent when the person may not remove sources. */
  readonly removal?: DataSourceRemoval | undefined;
}

/**
 * The connected sources in the shared responsive table, the same panel, rows and empty state as
 * pages, users and releases. A source's own page holds everything that is done with it.
 */
export async function DataSourcesList({
  locale,
  websiteId,
  sources,
  total,
  slice,
  hrefFor,
  mayCreate,
  removal,
}: DataSourcesListProps) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: 'dataSources' }),
    getAppFormatters(),
  ]);

  return (
    <DataPanel
      title={t('list.title')}
      description={t('list.description')}
      meta={t('panel.connected', { count: total })}
      footer={
        slice.pageCount > 1 ? (
          <Pagination locale={locale} slice={slice} hrefFor={hrefFor} label={t('pagination.nav')} />
        ) : undefined
      }
    >
      <ResponsiveTable
        label={t('list.title')}
        rows={sources}
        rowKey={(source) => source.id}
        density="standard"
        columns={dataSourceColumns({ t, format, websiteId, removal })}
        state={{
          kind: 'ready',
          empty: (
            <EmptyState
              className="py-10"
              icon={<UploadCloud className="size-6" aria-hidden="true" />}
              title={t('panel.emptyTitle')}
              description={t('panel.emptyDescription')}
              action={
                mayCreate ? (
                  <Button asChild>
                    <Link href={dataSourceRoutes.sourceNew(websiteId)}>{t('panel.newSource')}</Link>
                  </Button>
                ) : undefined
              }
            />
          ),
        }}
      />
    </DataPanel>
  );
}
