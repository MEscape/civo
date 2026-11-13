'use client';

import { createContext, use } from 'react';
import type { ReactNode } from 'react';

import { useTranslations } from '@i18n/client';

import { useMediaLibraryUpload } from '../../hooks/use-media-library-upload';
import { MediaFileInput } from '../shared/media-file-input.client';

import { MediaUploadReview } from './media-upload-review.client';

import type { MediaLibraryUpload } from '../../hooks/use-media-library-upload';

const MediaUploadContext = createContext<MediaLibraryUpload | null>(null);

/** The upload of the screen it wraps, for the controls that start it and the notices that report it. */
export function useMediaUploadScope(): MediaLibraryUpload {
  const upload = use(MediaUploadContext);
  if (upload === null) {
    throw new Error('Media upload controls must sit inside a MediaUploadScope.');
  }
  return upload;
}

interface MediaUploadScopeProps {
  readonly websiteId: string;
  readonly children: ReactNode;
}

/**
 * One upload for the whole media screen: the header's button and the empty list's invitation
 * start it, the notice above the list reports it. Holds the hidden file chooser and the review
 * that asks, before anything is sent, whether the files stay private.
 */
export function MediaUploadScope({ websiteId, children }: MediaUploadScopeProps) {
  const t = useTranslations('media');
  const upload = useMediaLibraryUpload(websiteId);

  return (
    <MediaUploadContext value={upload}>
      {children}
      <MediaFileInput
        inputRef={upload.fileInput}
        label={t('library.upload')}
        isMultiple
        onFiles={upload.choose}
      />
      <MediaUploadReview upload={upload} />
    </MediaUploadContext>
  );
}
