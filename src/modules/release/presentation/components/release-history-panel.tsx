'use client';

import { useId, useState, useTransition } from 'react';

import { EmptyState } from '@components/layout/layout-primitives';
import { FieldMessage } from '@components/shared/field-message';
import { Button } from '@components/ui/button';
import { AlertTriangle } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';
import { noop } from '@lib/utils';

import { publishReleaseAction } from '../actions/publish-release-action';
import { rollbackReleaseAction } from '../actions/rollback-release-action';
import { messageKeyForCode } from '../messages/message-keys';

import { ReleaseHistoryItem } from './release-history-item';

import type { ReleaseHistoryDto } from '../dto/release-history-dto';

export interface ReleaseHistoryPanelProps {
  readonly websiteId: string;
  /** Loaded by the Server Component, so the list renders without a client fetch. */
  readonly history: ReleaseHistoryDto;
}

/**
 * A website's release history with rollback. The list is server state: after
 * a rollback the route is refreshed instead of mirroring "which release is
 * active" in local state.
 */
export function ReleaseHistoryPanel({ websiteId, history }: ReleaseHistoryPanelProps) {
  const t = useTranslations('release');

  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [restoredNumber, setRestoredNumber] = useState<number | null>(null);
  const [publishedNumber, setPublishedNumber] = useState<number | null>(null);

  function handlePublish() {
    setErrorCode(null);
    setRestoredNumber(null);
    startTransition(async () => {
      const result = await publishReleaseAction({ websiteId });
      if (!result.ok) {
        setErrorCode(applyActionError(result.error, noop));
        return;
      }
      setPublishedNumber(result.data.releaseNumber);
    });
  }

  function handleRollback(releaseId: string) {
    setErrorCode(null);
    setRestoredNumber(null);
    setPublishedNumber(null);
    startTransition(async () => {
      const result = await rollbackReleaseAction({ websiteId, releaseId });
      if (!result.ok) {
        // A history list has no fields, so only the form-level code is used.
        setErrorCode(applyActionError(result.error, noop));
        return;
      }
      setRestoredNumber(result.data.releaseNumber);
    });
  }

  const publishControl = (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" onClick={handlePublish} disabled={isPending}>
        {isPending ? t('history.publishing') : t('history.publish')}
      </Button>
      {publishedNumber !== null && (
        <p role="status" className="text-sm text-success">
          {t('history.published', { number: publishedNumber })}
        </p>
      )}
    </div>
  );

  if (history.releases.length === 0) {
    return (
      <div className="flex flex-col gap-3" aria-busy={isPending}>
        {publishControl}
        <FieldMessage
          id={`${id}-error`}
          message={errorCode ? t(messageKeyForCode(errorCode)) : undefined}
          className="rounded-token border border-danger px-4 py-3"
        />
        <EmptyState
          title={t('history.empty')}
          icon={<AlertTriangle className="size-8" aria-hidden="true" />}
          variant="outlined"
          className="py-12"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" aria-busy={isPending}>
      {publishControl}
      <FieldMessage
        id={`${id}-error`}
        message={errorCode ? t(messageKeyForCode(errorCode)) : undefined}
        className="rounded-token border border-danger px-4 py-3"
      />
      {restoredNumber !== null && (
        <p role="status" className="text-sm text-success">
          {t('history.restored', { number: restoredNumber })}
        </p>
      )}

      <ul className="flex flex-col gap-2" aria-label={t('history.listLabel')}>
        {history.releases.map((release) => (
          <ReleaseHistoryItem
            key={release.id}
            release={release}
            isBusy={isPending}
            onRollback={handleRollback}
          />
        ))}
      </ul>

      <p className="text-xs text-copy-muted">{t('history.rollbackNote')}</p>
    </div>
  );
}
