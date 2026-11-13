'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useReportUnsavedChanges } from '@hooks/use-unsaved-changes';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { updateWebsiteAction } from '../actions/update-website-action';
import { toWebsiteEdit } from '../forms/to-website-edit';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { generalSettingsSchema } from '../schemas/general-settings-schema';

import type { GeneralSettings } from '../schemas/general-settings-schema';

interface GeneralSettingsFormOptions {
  readonly websiteId: string;
  readonly initialValues: GeneralSettings;
}

/** The website's general settings as a form: saving, the form-level refusal, the "saved" note and the unsaved-work guard. */
export function useGeneralSettingsForm({ websiteId, initialValues }: GeneralSettingsFormOptions) {
  const t = useTranslations('website');
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [hasSaved, setHasSaved] = useState(false);

  const form = useForm<GeneralSettings>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: initialValues,
  });
  const { isDirty } = form.formState;
  useReportUnsavedChanges(isDirty);

  /** A field's error code as text in this module's language; `undefined` while the field is valid. */
  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);

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

  return {
    form,
    isPending,
    isDirty,
    errorText,
    formError: errorText(formErrorCode ?? undefined),
    // Derived, not stored: the confirmation disappears as soon as the user edits again.
    showSaved: hasSaved && !isDirty,
    onSubmit: form.handleSubmit(handleSubmit),
  };
}
