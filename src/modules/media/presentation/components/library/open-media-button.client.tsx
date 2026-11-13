'use client';

import { ExternalLink } from '@components/icons/icons';
import { FieldMessage } from '@components/shared/field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useOpenPrivateMedia } from '../../hooks/use-open-private-media';
import { MESSAGE_PARAMS } from '../../messages/message-keys';

interface OpenMediaButtonProps {
  readonly websiteId: string;
  readonly assetId: string;
  readonly filename: string;
}

/**
 * Opens a private file in a new tab through a short-lived address; a public one needs no button.
 * It leaves the page, so it carries the "opens elsewhere" icon instead of the row arrow.
 */
export function OpenMediaButton({ websiteId, assetId, filename }: OpenMediaButtonProps) {
  const t = useTranslations('media');
  const { isPending, errorKey, handleOpen } = useOpenPrivateMedia(websiteId, assetId);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={isPending}
        aria-busy={isPending}
        aria-label={t('library.openLabel', { name: filename })}
        onClick={handleOpen}
      >
        <ExternalLink className="size-3.5" aria-hidden="true" />
        {t('library.open')}
      </Button>
      <FieldMessage
        id={`${assetId}-open-error`}
        message={errorKey === null ? undefined : t(errorKey, MESSAGE_PARAMS)}
        className="w-full text-right"
      />
    </>
  );
}
