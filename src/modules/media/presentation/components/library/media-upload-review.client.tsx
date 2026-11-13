'use client';

import { useId } from 'react';

import { ConfirmDialog } from '@components/shared/dialog';
import { CheckboxField } from '@components/shared/field';

import { useTranslations } from '@i18n/client';

import { MESSAGE_PARAMS } from '../../messages/message-keys';

import type { MediaLibraryUpload } from '../../hooks/use-media-library-upload';

/**
 * The step between choosing files and sending them: which files, and whether they stay private
 * (never shown on the website, opened only through a short-lived link). Public is the default.
 */
export function MediaUploadReview({ upload }: { readonly upload: MediaLibraryUpload }) {
  const t = useTranslations('media');
  const id = useId();

  return (
    <ConfirmDialog
      open={upload.chosen.length > 0}
      confirmVariant="default"
      title={t('library.review.title')}
      description={t('library.review.description', { count: upload.chosen.length })}
      confirmLabel={t('library.review.confirm')}
      cancelLabel={t('library.review.cancel')}
      onConfirm={upload.confirm}
      onCancel={upload.cancel}
    >
      <div className="space-y-4">
        <ul
          aria-label={t('library.review.filesLabel')}
          className="max-h-40 divide-y divide-border overflow-y-auto rounded-token border border-border text-sm"
        >
          {upload.chosen.map((file, index) => (
            <li key={`${String(index)}-${file.name}`} className="truncate px-3 py-2 text-copy">
              {file.name}
            </li>
          ))}
        </ul>
        <CheckboxField
          id={`${id}-private`}
          label={t('library.keepPrivate')}
          hint={t('library.privateHint')}
          checked={upload.isPrivate}
          onChange={(event) => {
            upload.setIsPrivate(event.target.checked);
          }}
        />
        <p className="text-xs text-copy-muted">{t('library.hint', MESSAGE_PARAMS)}</p>
      </div>
    </ConfirmDialog>
  );
}
