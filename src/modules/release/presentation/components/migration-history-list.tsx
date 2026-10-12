'use client';

import { EmptyState } from '@components/layout/layout-primitives';
import { Badge } from '@components/ui/badge';

import { useTranslations, useAppFormatters } from '@i18n/client';

import { MIGRATION_STATUS_MESSAGE_KEYS, NODE_STATUS_MESSAGE_KEYS } from '../messages/message-keys';

import { PagePathLabel } from './page-path-label';

import type { NodeMigrationStatus } from '../../application/contracts/release-constraints';
import type { MigrationHistoryDto } from '../dto/migration-history-dto';

const NODE_BADGE_VARIANTS = {
  unchanged: 'outline',
  upgradable: 'outline',
  needs_review: 'warning',
  unresolvable: 'danger',
} as const satisfies Record<NodeMigrationStatus, 'outline' | 'warning' | 'danger'>;

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
      {history.migrations.map((migration) => {
        const pages = migration.pages ?? [];
        const totalChanges = migration.changedNodeCount ?? 0;

        return (
          <li
            key={migration.id}
            className="flex flex-col gap-2 rounded-token border border-border bg-surface p-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={migration.status === 'applied' ? 'success' : 'outline'}>
                  {t(MIGRATION_STATUS_MESSAGE_KEYS[migration.status])}
                </Badge>
                {totalChanges > 0 && (
                  <Badge variant="secondary">
                    {t('migration.history.changeCount', { count: totalChanges })}
                  </Badge>
                )}
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
            </div>

            {pages.length > 0 && (
              <details className="mt-1 text-xs">
                <summary className="cursor-pointer font-medium text-copy hover:underline">
                  {t('migration.history.detailsToggle')}
                </summary>
                <div className="mt-2 space-y-2 rounded-token border border-border/50 bg-canvas p-3">
                  {pages.map((page) => (
                    <div key={page.path} className="space-y-1">
                      <p className="font-semibold text-copy">
                        <PagePathLabel path={page.path} />
                      </p>
                      {page.nodes.length === 0 ? (
                        <p className="text-copy-muted">{t('migration.history.noNodeChanges')}</p>
                      ) : (
                        <ul className="space-y-1 border-l border-border pl-3">
                          {page.nodes.map((node) => (
                            <li
                              key={node.nodeId}
                              className="flex flex-wrap items-center gap-2 text-copy-muted"
                            >
                              <span className="font-medium text-copy">{node.type}</span>
                              <span>
                                {node.toVersion !== undefined &&
                                node.status !== 'unresolvable' &&
                                node.fromVersion !== node.toVersion
                                  ? t('migration.history.versionChanged', {
                                      from: node.fromVersion,
                                      to: node.toVersion,
                                    })
                                  : t('migration.history.versionUnchanged', {
                                      version: node.fromVersion,
                                    })}
                              </span>
                              <Badge
                                variant={NODE_BADGE_VARIANTS[node.status]}
                                className="px-1 py-0 text-xs"
                              >
                                {t(NODE_STATUS_MESSAGE_KEYS[node.status])}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}
