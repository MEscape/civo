'use client';

import { useTransition } from 'react';

import { Button } from '@components/ui/button';
import { RefreshCw } from '@components/ui/icons';

import { useRouter } from '@i18n';

import { useAppFormatters, useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

export interface UpdatesCheckProps {
  /** When the update state was read (ISO). */
  readonly checkedAt: string;
}

/**
 * How fresh the update state is, and a way to read it again. The state is
 * computed on every request, so checking again is a read-only refresh of the
 * route; nothing is proposed or written.
 */
export function UpdatesCheck({ checkedAt }: UpdatesCheckProps) {
  const t = useTranslations('release');
  const format = useAppFormatters();
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();

  return (
    <div className="flex items-center gap-2" aria-busy={isRefreshing}>
      <span role="status" className="text-xs text-copy-muted">
        {isRefreshing
          ? t('updates.refreshing')
          : t('updates.checkedAt', { time: format.date(checkedAt, { timeStyle: 'short' }) })}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={isRefreshing}
        aria-label={t('migration.panel.check')}
        title={t('migration.panel.check')}
        onClick={() => {
          startRefresh(() => {
            router.refresh();
          });
        }}
      >
        <RefreshCw
          aria-hidden="true"
          className={cn(
            'transition-transform duration-500',
            isRefreshing ? 'animate-spin motion-reduce:animate-none' : 'hover:rotate-90',
          )}
        />
      </Button>
    </div>
  );
}
