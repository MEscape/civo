'use client';

import type { ComponentProps, RefCallback } from 'react';

import { Trash2, UploadCloud } from '@components/icons/icons';
import { FieldHint, FieldMessage } from '@components/shared/field';
import { Button } from '@components/ui/button';
import { Input, Label } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { PROFILE_IMAGE_TYPES } from '../../../application/contracts/profile-views';

import { ProfileAvatar } from './profile-avatar';

interface ProfilePhotoPickerProps {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
  readonly fileName: string | undefined;
  readonly error: string | undefined;
  readonly hasSelection: boolean;
  readonly imageField: Pick<ComponentProps<typeof Input>, 'name' | 'onBlur' | 'ref'>;
  readonly buttonRef: RefCallback<HTMLButtonElement>;
  readonly onPick: () => void;
  readonly onChoose: (file: File | undefined) => void;
  readonly onClear: () => void;
  readonly onRemove: () => void;
}

/** The file chooser uses the same buttons and field feedback as other application uploads. */
export function ProfilePhotoPicker({
  id,
  name,
  image,
  fileName,
  error,
  hasSelection,
  imageField,
  buttonRef,
  onPick,
  onChoose,
  onClear,
  onRemove,
}: ProfilePhotoPickerProps) {
  const t = useTranslations('auth');
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? `${hintId} ${errorId}` : hintId;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <ProfileAvatar name={name} image={image} className="size-20 text-2xl" />
      <div className="min-w-0 flex-1 space-y-3">
        <Label htmlFor={id}>{t('profile.photo')}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            ref={buttonRef}
            onClick={onPick}
            className={error ? 'border-danger' : undefined}
            aria-describedby={describedBy}
          >
            <UploadCloud className="size-4" aria-hidden="true" />
            {t(image === null ? 'profile.choosePhoto' : 'profile.changePhoto')}
          </Button>
          {hasSelection && (
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              {t('profile.clearSelection')}
            </Button>
          )}
          {image !== null && (
            <Button type="button" variant="destructive-ghost" size="sm" onClick={onRemove}>
              <Trash2 className="size-4" aria-hidden="true" />
              {t('profile.removePhoto')}
            </Button>
          )}
        </div>
        {fileName !== undefined && <p className="truncate text-xs text-copy-muted">{fileName}</p>}
        <FieldHint id={hintId} hint={t('profile.photoHint')} />
        <FieldMessage id={errorId} message={error} />
        {/* The input's own sizing (`w-full`, padding) beats `sr-only` on itself and widened the page; a wrapper clips it. */}
        <div className="sr-only">
          <Input
            id={id}
            type="file"
            accept={PROFILE_IMAGE_TYPES.join(',')}
            tabIndex={-1}
            aria-describedby={describedBy}
            aria-invalid={Boolean(error)}
            {...imageField}
            onChange={(event) => {
              onChoose(event.target.files?.[0]);
            }}
          />
        </div>
      </div>
    </div>
  );
}
