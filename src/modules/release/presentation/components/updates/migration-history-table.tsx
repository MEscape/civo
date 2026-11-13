import { RefreshCw } from '@components/icons/icons';
import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel } from '@components/shared/data-panel';
import { Pagination } from '@components/shared/pagination';
import { ResponsiveTable } from '@components/shared/responsive-table';
import type { ResponsiveColumn } from '@components/shared/responsive-table';
import { TableRowDetailsTrigger } from '@components/shared/table-row-details';
import { Badge } from '@components/ui/badge';

import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import type { Page } from '@lib/pagination';

import { MIGRATION_STATUS_MESSAGE_KEYS } from '../../messages/message-keys';

import { MigrationPageChanges } from './migration-page-changes';

import type { MigrationSummaryView } from '../../../application/contracts/migration-views';

export interface MigrationHistoryTableProps {
  readonly locale: Locale;
  /** One page of the earlier updates, newest first. */
  readonly history: Page<MigrationSummaryView>;
  /** The address of a page of the history, keeping the tab. */
  readonly hrefFor: (page: number) => string;
}

/** A website's earlier component updates, newest first, each opening across the row to show what changed on which page. */
export async function MigrationHistoryTable({
  locale,
  history,
  hrefFor,
}: MigrationHistoryTableProps) {
  const [t, format] = await Promise.all([getTranslations('release'), getAppFormatters()]);
  const columns: ReadonlyArray<ResponsiveColumn<MigrationSummaryView>> = [
    {
      id: 'status',
      label: t('migration.history.columns.status'),
      cell: (migration) => (
        <div className="space-y-2">
          <Badge variant={migration.status === 'applied' ? 'success' : 'outline'}>
            {t(MIGRATION_STATUS_MESSAGE_KEYS[migration.status])}
          </Badge>
          {(migration.changedNodeCount ?? 0) > 0 && (
            <p className="text-sm font-medium text-copy">
              {t('migration.history.changeCount', { count: migration.changedNodeCount ?? 0 })}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'dates',
      label: t('migration.history.columns.dates'),
      cell: (migration) => (
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs text-copy-muted">
          <dt>{t('migration.history.proposedAt')}</dt>
          <dd>
            <time dateTime={migration.createdAt.toISOString()}>
              {format.dateTime(migration.createdAt)}
            </time>
          </dd>
          {migration.appliedAt !== null && (
            <>
              <dt>{t('migration.history.appliedAt')}</dt>
              <dd>
                <time dateTime={migration.appliedAt.toISOString()}>
                  {format.dateTime(migration.appliedAt)}
                </time>
              </dd>
            </>
          )}
        </dl>
      ),
    },
    {
      id: 'details',
      label: t('migration.history.columns.details'),
      isAction: true,
      cell: ({ pages = [] }) => (
        <div className="flex justify-end">
          <TableRowDetailsTrigger
            label={t('migration.history.detailsToggle', { count: pages.length })}
          />
        </div>
      ),
    },
  ];

  return (
    <DataPanel
      title={t('updates.historyTitle')}
      meta={t('migration.history.count', { count: history.total })}
      footer={
        history.pageCount > 1 ? (
          <Pagination
            locale={locale}
            slice={history}
            hrefFor={hrefFor}
            label={t('migration.history.pagination.nav')}
          />
        ) : undefined
      }
    >
      <ResponsiveTable
        label={t('migration.history.listLabel')}
        rows={history.items}
        rowKey={(migration) => migration.id}
        density="compact"
        columns={columns}
        rowDetails={({ pages = [] }) =>
          pages.length === 0 ? null : (
            <ul className="space-y-2 bg-canvas p-4">
              {pages.map((page) => (
                <MigrationPageChanges key={page.path} page={page} t={t} />
              ))}
            </ul>
          )
        }
        state={{
          kind: 'ready',
          empty: (
            <EmptyState
              icon={<RefreshCw className="size-6" aria-hidden="true" />}
              title={t('migration.history.empty')}
              className="py-10"
            />
          ),
        }}
      />
    </DataPanel>
  );
}
