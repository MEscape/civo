'use client';

import { EmptyState } from '@components/layout/layout-primitives';
import { Badge } from '@components/ui/badge';

import { useTranslations, useAppFormatters } from '@i18n/client';

import { MIGRATION_STATUS_MESSAGE_KEYS } from '../messages/message-keys';

import type { MigrationHistoryDto } from '../dto/migration-history-dto';

export interface MigrationHistoryListProps {
  readonly history: MigrationHistoryDto;
}

/** A website's migration audit trail, newest first. Server state: the route is refreshed after an apply. */
export function MigrationHistoryList({ history }: MigrationHistoryListProps) {
  const t = useTranslations('release');
  const format = useAppFormatters();

  if (history.migrations.length === 0) {
    return <EmptyState title={t('migration.history.empty')} variant="outlined" className="py-10" />;
  }

  return (
    <ul className="flex flex-col gap-2" aria-label={t('migration.history.listLabel')}>
      {history.migrations.map((migration) => (
        <li
          key={migration.id}
          className="flex flex-col gap-1 rounded-token border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={migration.status === 'applied' ? 'success' : 'outline'}>
              {t(MIGRATION_STATUS_MESSAGE_KEYS[migration.status])}
            </Badge>
            <span className="text-xs text-copy-muted">
              {t('migration.history.proposedAt', {
                date: format.dateTime(migration.createdAt),
              })}
            </span>
          </div>
          {migration.appliedAt !== null && (
            <span className="text-xs text-copy-muted">
              {t('migration.history.appliedAt', {
                date: format.dateTime(migration.appliedAt),
              })}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
