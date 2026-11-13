'use client';

import { UploadCloud } from '@components/icons/icons';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useMediaUploadScope } from './media-upload-scope.client';

/** The screen's main action: choose images to upload. The review that follows asks the rest. */
export function MediaUploadButton() {
  const t = useTranslations('media');
  const { isUploading, openPicker } = useMediaUploadScope();

  return (
    <Button type="button" disabled={isUploading} onClick={openPicker}>
      <UploadCloud className="size-4" aria-hidden="true" />
      {isUploading ? t('picker.uploading') : t('library.upload')}
    </Button>
  );
}
