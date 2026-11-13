'use client';

import { useId } from 'react';

import { FieldMessage } from '@components/shared/field';
import { Alert } from '@components/ui/alert';
import { Button } from '@components/ui/button';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { useMediaPicker } from '../../hooks/use-media-picker';
import { MESSAGE_PARAMS } from '../../messages/message-keys';
import { mediaRoutes } from '../../routes';
import { MediaFileInput } from '../shared/media-file-input.client';

import { ChosenImage } from './chosen-image';
import { ImageGrid } from './image-grid';

export interface MediaPickerProps {
  /** The website whose images are offered. The server checks the person may use them. */
  readonly websiteId: string;
  /** The id of the chosen file, if any. */
  readonly value: string | undefined;
  /** `undefined` clears the choice. */
  readonly onChange: (assetId: string | undefined) => void;
  /** Called after a discrete choice, so an editor can end an undo step. */
  readonly onCommit?: () => void;
  /** The element id a `<label htmlFor>` points at. */
  readonly id?: string;
}

/**
 * Chooses one public image of the website, or uploads a new one. Files go straight from the
 * browser to the store; this component only ever holds the id of the choice. A private file is
 * never offered: nothing a visitor can open may point at it.
 */
export function MediaPicker({ websiteId, value, onChange, onCommit, id }: MediaPickerProps) {
  const t = useTranslations('media');
  const picker = useMediaPicker({ websiteId, value, onChange, onCommit });
  const { fileInput, isOpen, isUploading, isTruncated, problem } = picker;
  const pickerId = useId();

  return (
    <div className="space-y-2" id={id}>
      {value !== undefined && (
        <ChosenImage chosen={picker.chosen} fallback={t('picker.selected')} />
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-expanded={isOpen}
          onClick={picker.toggle}
        >
          {t('picker.choose')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isUploading}
          onClick={() => fileInput.current?.click()}
        >
          {isUploading ? t('picker.uploading') : t('picker.upload')}
        </Button>
        {value !== undefined && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              picker.choose(undefined);
            }}
          >
            {t('picker.remove')}
          </Button>
        )}
        <MediaFileInput
          inputRef={fileInput}
          label={t('picker.upload')}
          onFiles={(files) => void picker.uploadFile(files[0])}
        />
      </div>

      <FieldMessage
        id={`${pickerId}-problem`}
        message={problem === null ? undefined : t(problem, MESSAGE_PARAMS)}
      />

      {isOpen && (
        <ImageGrid
          assets={picker.assets}
          isLoading={picker.isLoading}
          value={value}
          onChoose={picker.choose}
        />
      )}

      {isOpen && isTruncated && (
        <Alert variant="info" role="status" className="p-2 text-xs">
          {t('picker.truncated', { shown: picker.assets.length, total: picker.total })}{' '}
          <Link href={mediaRoutes.library(websiteId)} className="font-medium underline">
            {t('picker.openLibrary')}
          </Link>
        </Alert>
      )}
    </div>
  );
}
