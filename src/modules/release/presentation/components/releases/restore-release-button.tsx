'use client';

import { useId } from 'react';

import { Undo2 } from '@components/icons/icons';
import { ConfirmDialog } from '@components/shared/dialog';
import { FieldMessage, FieldSuccess } from '@components/shared/field';
import { Button } from '@components/ui/button';

import { useAppFormatters, useTranslations } from '@i18n/client';

import { useRestoreRelease } from '../../hooks/use-restore-release';

export interface RestoreReleaseButtonProps {
  readonly websiteId: string;
  readonly releaseId: string;
  readonly releaseNumber: number;
  /** When the release was published (ISO), for the question. */
  readonly publishedAt: string;
  /** Quiet in a list row, framed in a page heading. */
  readonly variant?: 'ghost' | 'outline';
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
  variant = 'outline',
}: RestoreReleaseButtonProps) {
  const t = useTranslations('release');
  const format = useAppFormatters();
  const id = useId();
  const restore = useRestoreRelease(websiteId, releaseId);
  const { isPending, errorKey } = restore;

  return (
    <div className="flex flex-col items-end gap-1" aria-busy={isPending}>
      <Button
        variant={variant}
        size="sm"
        disabled={isPending}
        aria-label={t('history.rollbackLabel', { number: releaseNumber })}
        onClick={restore.open}
      >
        <Undo2 className="size-3.5" aria-hidden="true" />
        {t('history.rollback')}
      </Button>
      {restore.isRestored && (
        <div role="status" className="text-xs">
          <FieldSuccess>{t('history.restored', { number: releaseNumber })}</FieldSuccess>
        </div>
      )}
      <FieldMessage
        id={`${id}-error`}
        message={errorKey === null ? undefined : t(errorKey)}
        className="max-w-xs text-right"
      />
      <ConfirmDialog
        open={restore.isConfirming}
        confirmVariant="default"
        isPending={isPending}
        title={t('restore.title', { number: releaseNumber })}
        description={t('restore.description', { date: format.dateTime(publishedAt) })}
        confirmLabel={t('restore.confirm')}
        cancelLabel={t('restore.cancel')}
        onConfirm={restore.confirm}
        onCancel={restore.close}
      />
    </div>
  );
}
