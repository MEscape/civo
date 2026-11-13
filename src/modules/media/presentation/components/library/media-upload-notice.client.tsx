'use client';

import { Alert } from '@components/ui/alert';

import { useTranslations } from '@i18n/client';

import { MESSAGE_PARAMS } from '../../messages/message-keys';

import { useMediaUploadScope } from './media-upload-scope.client';

/**
 * How the upload goes, above the list: while it runs, what arrived, and why it stopped. A failure
 * stops the remaining files, so a partial upload shows both what arrived and why the rest did not.
 */
export function MediaUploadNotice() {
  const t = useTranslations('media');
  const { isUploading, sending, stored, problem } = useMediaUploadScope();

  return (
    <>
      {isUploading && (
        <Alert variant="info" role="status" className="text-sm">
          {t('library.notice.uploading', { count: sending })}
        </Alert>
      )}
      {!isUploading && stored > 0 && (
        <Alert variant="success" role="status" className="text-sm">
          {t('library.notice.uploaded', { count: stored })}
        </Alert>
      )}
      {problem !== null && (
        <Alert variant="danger" role="alert" className="text-sm">
          {t(problem, MESSAGE_PARAMS)}
        </Alert>
      )}
    </>
  );
}
