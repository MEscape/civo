import type { ReactNode } from 'react';

import { FileText } from '@components/icons/icons';
import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel } from '@components/shared/data-panel';
import { ResponsiveTable } from '@components/shared/responsive-table';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { builderRoutes } from '../../routes';

import { pageListColumns } from './page-list-columns';

import type { PageListItemDto } from '../../dto/page-dto';

interface PageListProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly pages: readonly PageListItemDto[];
  readonly total: number;
  /** Display only: offers the first page from the empty state. */
  readonly canCreate?: boolean;
  readonly pagination?: ReactNode;
}

/**
 * One slice of a website's pages in the shared responsive table, with a sketch of each page in
 * its first column. The same panel, rows and responsive behaviour as releases, users and audit.
 */
export async function PageList({
  locale,
  websiteId,
  pages,
  total,
  canCreate = false,
  pagination,
}: PageListProps) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: 'builder' }),
    getAppFormatters(),
  ]);

  return (
    <DataPanel
      title={t('pages.list.label')}
      meta={t('pages.list.count', { count: total })}
      footer={pagination}
    >
      <ResponsiveTable
        label={t('pages.list.label')}
        rows={pages}
        rowKey={(page) => page.id}
        density="standard"
        columns={pageListColumns({ t, format, websiteId })}
        state={{
          kind: 'ready',
          empty: (
            <EmptyState
              className="py-10"
              icon={<FileText className="size-6" aria-hidden="true" />}
              title={t('pages.list.empty')}
              description={
                canCreate
                  ? t('pages.list.emptyCreateDescription')
                  : t('pages.list.emptyDescription')
              }
              action={
                canCreate && (
                  <Link href={builderRoutes.create(websiteId)} className={buttonVariants()}>
                    {t('pages.list.createTitle')}
                  </Link>
                )
              }
            />
          ),
        }}
      />
    </DataPanel>
  );
}
