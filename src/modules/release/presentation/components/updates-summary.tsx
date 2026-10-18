'use client';

import { Badge } from '@components/ui/badge';
import { Check } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import type { PublicationStatusView } from '../../application/contracts/release-views';

type Updates = NonNullable<PublicationStatusView['componentUpdates']>;

/** "Everything is up to date", ticked: the one line shown when nothing is left to update. */
export function UpToDate({ className }: { readonly className?: string }) {
  const t = useTranslations('release');
  return (
    <p
      role="status"
      className={cn('flex items-center gap-2 text-sm font-medium text-success', className)}
    >
      <Check className="size-4" aria-hidden="true" />
      {t('updates.upToDateTitle')}
    </p>
  );
}

/** The state in one line, with the counts as badges: what a person needs to know before opening anything. */
export function UpdatesSummary({ updates }: { readonly updates: Updates }) {
  const t = useTranslations('release');
  const ready = updates.available - updates.needReview;

  if (updates.available + updates.unresolvable === 0) {
    return <UpToDate className="p-4" />;
  }
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3"
    >
      <p className="mr-1 text-sm font-medium text-copy">
        {updates.available > 0
          ? t('updates.summary', { count: updates.available })
          : t('updates.blockedSummary', { count: updates.unresolvable })}
      </p>
      {ready > 0 && <Badge variant="success">{t('updates.readyCount', { count: ready })}</Badge>}
      {updates.needReview > 0 && (
        <Badge variant="warning">{t('updates.reviewCount', { count: updates.needReview })}</Badge>
      )}
      {updates.available > 0 && updates.unresolvable > 0 && (
        <Badge variant="danger">{t('updates.blockedCount', { count: updates.unresolvable })}</Badge>
      )}
    </div>
  );
}
