'use client';

import { useId } from 'react';

import { DataPanel, DataPanelBody, DataPanelSaveFooter } from '@components/shared/data-panel';
import { TextareaField, TextField } from '@components/shared/field';

import { useTranslations } from '@i18n/client';

import { useGeneralSettingsForm } from '../hooks/use-general-settings-form';

import type { GeneralSettings } from '../schemas/general-settings-schema';

interface GeneralSettingsFormProps {
  readonly websiteId: string;
  readonly initialValues: GeneralSettings;
  /** Shown read-only: it is part of the public address and cannot change. */
  readonly slug: string;
}

export function GeneralSettingsForm({ websiteId, initialValues, slug }: GeneralSettingsFormProps) {
  const t = useTranslations('website');
  const id = useId();
  const settings = useGeneralSettingsForm({ websiteId, initialValues });
  const { form, isPending, isDirty, errorText } = settings;

  return (
    <DataPanel title={t('generalSettings.title')} description={t('generalSettings.description')}>
      <form onSubmit={settings.onSubmit} noValidate aria-busy={isPending}>
        <DataPanelBody>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <TextField
              id={`${id}-name`}
              label={t('generalSettings.name')}
              autoComplete="organization"
              error={errorText(form.formState.errors.name?.message)}
              {...form.register('name')}
            />
            <TextField
              id={`${id}-slug`}
              label={t('generalSettings.slug')}
              hint={t('generalSettings.slugHint')}
              value={slug}
              readOnly
              className="bg-canvas text-copy-muted"
            />
          </div>

          <TextareaField
            id={`${id}-description`}
            label={t('generalSettings.descriptionLabel')}
            rows={3}
            placeholder={t('generalSettings.descriptionPlaceholder')}
            error={errorText(form.formState.errors.description?.message)}
            {...form.register('description')}
          />
        </DataPanelBody>

        <DataPanelSaveFooter
          id={id}
          isPending={isPending}
          isDirty={isDirty}
          showSaved={settings.showSaved}
          savedLabel={t('generalSettings.saved')}
          unsavedLabel={t('settingsActions.unsaved')}
          submitLabel={isPending ? t('generalSettings.submitting') : t('generalSettings.submit')}
          error={settings.formError}
        />
      </form>
    </DataPanel>
  );
}
