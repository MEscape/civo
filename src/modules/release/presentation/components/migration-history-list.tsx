'use client';

import type { ReactNode } from 'react';

import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel } from '@components/shared/data-panel';
import { Badge } from '@components/ui/badge';
import { ChevronDown } from '@components/ui/icons';

import { useAppFormatters, useTranslations } from '@i18n/client';

import { MIGRATION_STATUS_MESSAGE_KEYS } from '../messages/message-keys';

import { MigrationPageChanges } from './migration-page-changes';

import type { MigrationHistoryDto } from '../dto/migration-history-dto';

export interface MigrationHistoryListProps {
  readonly history: MigrationHistoryDto;
  /** Every update ever proposed, not only this page of them. */
  readonly total: number;
  /** The names people know components by, by type; a type without one is shown as it is. */
  readonly componentLabels: Readonly<Record<string, string>>;
  /** The page links, drawn in the panel's footer when there is more than one page. */
  readonly pagination?: ReactNode;
}

/**
 * A website's earlier component updates, newest first, in the frame of the
 * release history. Server state: the route is refreshed after an apply.
 */
export function MigrationHistoryList({
  history,
  total,
  componentLabels,
  pagination,
}: MigrationHistoryListProps) {
  const t = useTranslations('release');
  const format = useAppFormatters();
  const lastProposed = history.migrations[0]?.createdAt;

  return (
    <DataPanel
      title={t('updates.historyTitle', { count: total })}
      meta={
        lastProposed === undefined
          ? undefined
          : t('updates.lastProposed', { date: format.date(lastProposed) })
      }
      footer={pagination}
    >
      {history.migrations.length === 0 ? (
        <EmptyState title={t('migration.history.empty')} className="py-10" />
      ) : (
        <ul className="divide-y divide-border" aria-label={t('migration.history.listLabel')}>
          {history.migrations.map((migration) => {
            const pages = migration.pages ?? [];
            const totalChanges = migration.changedNodeCount ?? 0;

            return (
              <li key={migration.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={migration.status === 'applied' ? 'success' : 'outline'}>
                      {t(MIGRATION_STATUS_MESSAGE_KEYS[migration.status])}
                    </Badge>
                    {totalChanges > 0 && (
                      <span className="text-sm font-medium text-copy">
                        {t('migration.history.changeCount', { count: totalChanges })}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-copy-muted">
                    <span>
                      {t('migration.history.proposedAt', {
                        date: format.dateTime(migration.createdAt),
                      })}
                    </span>
                    {migration.appliedAt !== null && (
                      <span>
                        {t('migration.history.appliedAt', {
                          date: format.dateTime(migration.appliedAt),
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {pages.length > 0 && (
                  <details className="group">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-token-sm text-xs font-medium text-copy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
                      <ChevronDown
                        className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                        aria-hidden="true"
                      />
                      {t('migration.history.detailsToggle', { count: pages.length })}
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {pages.map((page) => (
                        <MigrationPageChanges
                          key={page.path}
                          page={page}
                          labels={componentLabels}
                        />
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </DataPanel>
  );
}
