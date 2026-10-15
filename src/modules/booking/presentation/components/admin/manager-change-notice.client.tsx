'use client';

import { useState, useTransition } from 'react';

import { Button } from '@components/ui/button';
import { Icons } from '@components/ui/icons';

import { useAppFormatters, useTranslations } from '@i18n/client';

import { acknowledgeManagerChangeAction } from '../../actions/acknowledge-manager-change-action';

import type { ResourceDto } from '../../dto/setup-dto';

export interface ManagerChangeNoticeProps {
  readonly websiteId: string;
  readonly change: NonNullable<ResourceDto['managerChange']>;
}

/**
 * Tells an employee that somebody else changed their calendar, and what: an
 * employee is never changed behind their back. It stays until they say they
 * have seen it (or save their calendar themselves, which clears it).
 */
export function ManagerChangeNotice({ websiteId, change }: ManagerChangeNoticeProps) {
  const t = useTranslations('booking');
  const formats = useAppFormatters();
  const [isPending, startTransition] = useTransition();
  const [isSeen, setIsSeen] = useState(false);

  if (isSeen) {
    return null;
  }
  const what = change.kinds
    .map((kind) => t(kind === 'hours' ? 'own.change.hours' : 'own.change.services'))
    .join(', ');

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-token border border-warning-border bg-warning-subtle p-4 text-sm text-warning"
    >
      <p className="flex items-start gap-2">
        <Icons.info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{t('own.change.notice', { date: formats.dateTime(change.at), what })}</span>
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await acknowledgeManagerChangeAction({ websiteId });
            if (result.ok) {
              setIsSeen(true);
            }
          });
        }}
      >
        {t('own.change.seen')}
      </Button>
    </div>
  );
}
