'use client';

import { useId, useState, useTransition } from 'react';

import { ConfirmDialog } from '@components/shared/confirm-dialog';
import { FieldMessage } from '@components/shared/field-message';
import { Button } from '@components/ui/button';
import { Undo2 } from '@components/ui/icons';

import { useAppFormatters, useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';
import { noop } from '@lib/utils';

import { rollbackReleaseAction } from '../actions/rollback-release-action';
import { messageKeyForCode } from '../messages/message-keys';

export interface RestoreReleaseButtonProps {
  readonly websiteId: string;
  readonly releaseId: string;
  readonly releaseNumber: number;
  /** When the release was published (ISO), for the question. */
  readonly publishedAt: string;
}

/**
 * Sets the live website back to an earlier release, behind a question that
 * says what happens: the unchanged release is reactivated, drafts stay as they
 * are and nothing is deleted. The result is server state: the action
 * invalidates the routes that show it.
 */
export function RestoreReleaseButton({
  websiteId,
  releaseId,
  releaseNumber,
  publishedAt,
}: RestoreReleaseButtonProps) {
  const t = useTranslations('release');
  const format = useAppFormatters();
  const id = useId();
  const [isAsking, setIsAsking] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isRestored, setIsRestored] = useState(false);

  function handleConfirm() {
    setErrorCode(null);
    startTransition(async () => {
      const result = await rollbackReleaseAction({ websiteId, releaseId });
      if (!result.ok) {
        // A release has no fields, so only the form-level code is used.
        setErrorCode(applyActionError(result.error, noop));
        setIsAsking(false);
        return;
      }
      setIsRestored(true);
      setIsAsking(false);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1" aria-busy={isPending}>
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        aria-label={t('history.rollbackLabel', { number: releaseNumber })}
        onClick={() => {
          setIsRestored(false);
          setIsAsking(true);
        }}
      >
        <Undo2 className="size-3.5" aria-hidden="true" />
        {t('history.rollback')}
      </Button>
      {isRestored && (
        <p role="status" className="text-xs text-success">
          {t('history.restored', { number: releaseNumber })}
        </p>
      )}
      <FieldMessage
        id={`${id}-error`}
        message={errorCode ? t(messageKeyForCode(errorCode)) : undefined}
        className="max-w-xs text-right"
      />
      <ConfirmDialog
        open={isAsking}
        confirmVariant="default"
        isPending={isPending}
        title={t('restore.title', { number: releaseNumber })}
        description={t('restore.description', { date: format.dateTime(publishedAt) })}
        confirmLabel={t('restore.confirm')}
        cancelLabel={t('restore.cancel')}
        onConfirm={handleConfirm}
        onCancel={() => {
          setIsAsking(false);
        }}
      />
    </div>
  );
}
