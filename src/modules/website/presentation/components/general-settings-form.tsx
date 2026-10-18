'use client';

import { useId, useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { DataPanel } from '@components/shared/data-panel';
import { FormPanelBody } from '@components/shared/form-panel';
import { TextField } from '@components/shared/text-field';
import { useReportUnsavedChanges } from '@components/shared/unsaved-changes-guard';
import { Field, FieldError, Label, Textarea } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { updateWebsiteAction } from '../actions/update-website-action';
import { toWebsiteEdit } from '../forms/to-website-edit';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { generalSettingsSchema } from '../schemas/general-settings-schema';

import { SettingsActions } from './settings-actions';

import type { GeneralSettings } from '../schemas/general-settings-schema';

export interface GeneralSettingsFormProps {
  readonly websiteId: string;
  readonly initialValues: GeneralSettings;
  /** Shown read-only: it is part of the public address and cannot change. */
  readonly slug: string;
}

export function GeneralSettingsForm({ websiteId, initialValues, slug }: GeneralSettingsFormProps) {
  const t = useTranslations('website');
  /** A field's error code as text in this module's language; `undefined` while the field is valid. */
  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);

  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [hasSaved, setHasSaved] = useState(false);

  const form = useForm<GeneralSettings>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: initialValues,
  });
  const { errors, isDirty } = form.formState;
  useReportUnsavedChanges(isDirty);

  // Derived, not stored: the confirmation disappears as soon as the user edits again.
  const showSaved = hasSaved && !isDirty;

  const nameId = `${id}-name`;
  const slugId = `${id}-slug`;
  const descriptionId = `${id}-description`;
  const descriptionError = errorText(errors.description?.message);

  function handleSubmit(values: GeneralSettings) {
    setFormErrorCode(null);
    setHasSaved(false);
    startTransition(async () => {
      const result = await updateWebsiteAction(toWebsiteEdit(websiteId, values));
      if (!result.ok) {
        setFormErrorCode(applyActionError(result.error, form.setError));
        return;
      }
      form.reset({ name: result.data.name, description: result.data.description ?? '' });
      setHasSaved(true);
    });
  }

  return (
    <DataPanel title={t('generalSettings.title')} description={t('generalSettings.description')}>
      <form onSubmit={form.handleSubmit(handleSubmit)} noValidate aria-busy={isPending}>
        <FormPanelBody>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <TextField
              id={nameId}
              label={t('generalSettings.name')}
              autoComplete="organization"
              error={errorText(errors.name?.message)}
              {...form.register('name')}
            />
            <TextField
              id={slugId}
              label={t('generalSettings.slug')}
              hint={t('generalSettings.slugHint')}
              value={slug}
              readOnly
              className="bg-canvas text-copy-muted"
            />
          </div>

          <Field>
            <Label htmlFor={descriptionId}>{t('generalSettings.descriptionLabel')}</Label>
            <Textarea
              id={descriptionId}
              rows={3}
              placeholder={t('generalSettings.descriptionPlaceholder')}
              aria-invalid={descriptionError === undefined ? undefined : true}
              aria-describedby={
                descriptionError === undefined ? undefined : `${descriptionId}-error`
              }
              {...form.register('description')}
            />
            {descriptionError !== undefined && (
              <FieldError id={`${descriptionId}-error`}>{descriptionError}</FieldError>
            )}
          </Field>
        </FormPanelBody>

        <SettingsActions
          id={id}
          isPending={isPending}
          isDirty={isDirty}
          showSaved={showSaved}
          savedLabel={t('generalSettings.saved')}
          unsavedLabel={t('settingsActions.unsaved')}
          submitLabel={isPending ? t('generalSettings.submitting') : t('generalSettings.submit')}
          error={
            formErrorCode === null ? undefined : t(messageKeyForCode(formErrorCode), MESSAGE_PARAMS)
          }
        />
      </form>
    </DataPanel>
  );
}
