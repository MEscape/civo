'use client';

import { useId, useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { FieldMessage } from '@components/shared/field-message';
import { TextField } from '@components/shared/text-field';
import { Button } from '@components/ui/button';
import { Field, FieldError, Label, Textarea } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { updateWebsiteAction } from '../actions/update-website-action';
import { toWebsiteEdit } from '../forms/to-website-edit';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { generalSettingsSchema } from '../schemas/general-settings-schema';

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
    <section aria-labelledby={`${id}-title`} className="space-y-6">
      <div className="space-y-1">
        <h2 id={`${id}-title`} className="text-xl font-semibold text-copy">
          {t('generalSettings.title')}
        </h2>
        <p className="text-sm text-copy-muted">{t('generalSettings.description')}</p>
      </div>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        noValidate
        aria-busy={isPending}
        className="space-y-6 rounded-token border border-border bg-surface p-4 sm:p-6"
      >
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
          />
        </div>

        <Field>
          <Label htmlFor={descriptionId}>{t('generalSettings.descriptionLabel')}</Label>
          <Textarea
            id={descriptionId}
            rows={3}
            placeholder={t('generalSettings.descriptionPlaceholder')}
            aria-invalid={descriptionError === undefined ? undefined : true}
            aria-describedby={descriptionError === undefined ? undefined : `${descriptionId}-error`}
            {...form.register('description')}
          />
          {descriptionError !== undefined && (
            <FieldError id={`${descriptionId}-error`}>{descriptionError}</FieldError>
          )}
        </Field>

        {formErrorCode !== null && (
          <FieldMessage
            id={`${id}-form-error`}
            message={t(messageKeyForCode(formErrorCode), MESSAGE_PARAMS)}
            className="text-sm"
          />
        )}
        {showSaved && (
          <p role="status" className="text-sm text-success">
            {t('generalSettings.saved')}
          </p>
        )}

        <Button type="submit" disabled={isPending || !isDirty}>
          {isPending ? t('generalSettings.submitting') : t('generalSettings.submit')}
        </Button>
      </form>
    </section>
  );
}
