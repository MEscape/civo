'use client';

import { Trash2 } from '@components/icons/icons';
import { DeleteWhenUnusedDialog } from '@components/shared/dialog';
import type { UnusedCheckUse } from '@components/shared/dialog';
import { FieldMessage } from '@components/shared/field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useDeleteMediaAsset } from '../../hooks/use-delete-media-asset';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';

interface DeleteMediaButtonProps {
  readonly websiteId: string;
  readonly assetId: string;
  readonly filename: string;
  /** The components of saved pages still showing the file; `null` when that is unknown. */
  readonly uses: readonly UnusedCheckUse[] | null;
}

/**
 * Removes a file for good, behind a question that names it, or says first where it is still
 * shown, each place one click away. The server still refuses a file a draft or any release uses
 * (a release is not listed here); that reason is shown beside the button.
 */
export function DeleteMediaButton({ websiteId, assetId, filename, uses }: DeleteMediaButtonProps) {
  const t = useTranslations('media');
  const flow = useDeleteMediaAsset(websiteId, assetId);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="destructive-ghost"
        disabled={flow.isPending}
        aria-label={t('delete.label', { name: filename })}
        onClick={flow.open}
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        {t('delete.action')}
      </Button>
      <FieldMessage
        id={`${assetId}-delete-error`}
        message={flow.errorCode ? t(messageKeyForCode(flow.errorCode), MESSAGE_PARAMS) : undefined}
        className="w-full text-right"
      />
      <DeleteWhenUnusedDialog
        open={flow.isConfirming}
        uses={uses}
        title={t('delete.title')}
        description={t('delete.description', { name: filename })}
        confirmLabel={t('delete.confirm')}
        labels={{
          inUseTitle: t('delete.inUseTitle', { name: filename }),
          inUseDescription: t('delete.inUseDescription', { count: uses?.length ?? 0 }),
          // Only drafts are listed here, so the live-only case never arises.
          liveDescription: t('delete.inUseDescription', { count: 0 }),
          unknownDescription: t('delete.unknown', { name: filename }),
          openFirst: t('delete.openFirst'),
          openLive: t('delete.openFirst'),
          close: t('delete.cancel'),
        }}
        isPending={flow.isPending}
        onDelete={flow.confirm}
        onClose={flow.close}
      />
    </>
  );
}
