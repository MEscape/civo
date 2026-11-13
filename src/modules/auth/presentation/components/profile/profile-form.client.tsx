'use client';

import { useId } from 'react';

import { DataPanel, DataPanelBody, DataPanelSaveFooter } from '@components/shared/data-panel';
import { TextField } from '@components/shared/field';

import { useTranslations } from '@i18n/client';

import { useProfileForm } from '../../hooks/use-profile-form';

import { ProfilePhotoPicker } from './profile-photo-picker.client';

import type { ProfileView } from '../../../application/contracts/profile-views';

export function ProfileForm({ profile }: { readonly profile: ProfileView }) {
  const t = useTranslations('auth');
  const id = useId();
  const {
    form,
    handleSubmit,
    isPending,
    image,
    errorText,
    imageField,
    nameField,
    chooseImage,
    removePhoto,
    isSaved,
    formError,
    photoButtonRef,
    openFilePicker,
    clearPhotoSelection,
    fileName,
    hasPhotoSelection,
    imageError,
  } = useProfileForm(profile);

  return (
    <DataPanel title={t('profile.editTitle')} description={t('profile.editDescription')}>
      <form onSubmit={handleSubmit} noValidate aria-busy={isPending}>
        <fieldset disabled={isPending}>
          <legend className="sr-only">{t('profile.editTitle')}</legend>
          <DataPanelBody>
            <ProfilePhotoPicker
              id={`${id}-image`}
              name={profile.name}
              image={image}
              imageField={imageField}
              buttonRef={photoButtonRef}
              fileName={fileName}
              error={imageError}
              hasSelection={hasPhotoSelection}
              onPick={openFilePicker}
              onChoose={chooseImage}
              onClear={clearPhotoSelection}
              onRemove={removePhoto}
            />
            <TextField
              id={`${id}-name`}
              label={t('profile.name')}
              autoComplete="name"
              error={errorText(form.formState.errors.name?.message)}
              {...nameField}
            />
          </DataPanelBody>
        </fieldset>
        <DataPanelSaveFooter
          id={id}
          isPending={isPending}
          isDirty={form.formState.isDirty}
          showSaved={isSaved && !form.formState.isDirty}
          savedLabel={t('profile.saved')}
          unsavedLabel={t('profile.unsaved')}
          submitLabel={isPending ? t('profile.saving') : t('profile.save')}
          error={formError ?? undefined}
        />
      </form>
    </DataPanel>
  );
}
