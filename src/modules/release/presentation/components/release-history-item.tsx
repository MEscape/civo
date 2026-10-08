'use client';

import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Check, Undo2, AlertTriangle } from '@components/ui/icons';

import { useTranslations, useAppFormatters } from '@i18n/client';

import { cn } from '@lib/utils';

import { ReleaseStatusBadge } from './release-status-badge';

import type { ReleaseSummaryDto } from '../dto/release-dto';

export interface ReleaseHistoryItemProps {
  readonly release: ReleaseSummaryDto;
  /** True while any rollback is running, so two cannot be started at once. */
  readonly isBusy: boolean;
  readonly onRollback: (releaseId: string) => void;
}

/**
 * One release. Whether it can be restored was decided by the server
 * (`canRollback`); this component only renders that answer.
 */
export function ReleaseHistoryItem({ release, isBusy, onRollback }: ReleaseHistoryItemProps) {
  const t = useTranslations('release');
  const format = useAppFormatters();
  const number = release.releaseNumber;

  return (
    <li
      aria-current={release.isActive ? 'true' : undefined}
      className={cn(
        'flex flex-col gap-2 rounded-token border p-4 sm:flex-row sm:items-center sm:justify-between',
        release.isActive ? 'border-accent' : 'border-border bg-surface',
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-copy">
            {t('history.releaseNumber', { number })}
          </span>
          <ReleaseStatusBadge status={release.status} />
          {release.isActive && <Badge>{t('history.active')}</Badge>}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-copy-muted">
          {release.publishedAt !== null && (
            <span className="flex items-center gap-1">
              <Check className="size-3" aria-hidden="true" />
              {t('history.publishedAt', {
                date: format.dateTime(release.publishedAt),
              })}
            </span>
          )}
          <span className="flex items-center gap-1">
            {t('history.createdAt', {
              date: format.dateTime(release.createdAt),
            })}
          </span>
        </div>
      </div>

      {release.canRollback && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={isBusy}
          aria-label={t('history.rollbackLabel', { number })}
          onClick={() => {
            onRollback(release.id);
          }}
        >
          <Undo2 className="size-3.5" aria-hidden="true" />
          <span className="ml-1.5">{t('history.rollback')}</span>
        </Button>
      )}

      {release.status === 'failed' && (
        <p className="flex shrink-0 items-center gap-1.5 text-xs text-danger">
          <AlertTriangle className="size-3.5" aria-hidden="true" />
          {t('history.buildFailed')}
        </p>
      )}
    </li>
  );
}
