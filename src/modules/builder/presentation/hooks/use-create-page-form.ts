'use client';

import { useState, useTransition } from 'react';
import type { ChangeEvent, SyntheticEvent } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useReportUnsavedChanges } from '@hooks/use-unsaved-changes';
import { useWizardSteps } from '@hooks/use-wizard-steps';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { BUILDER_ERROR_CODES } from '../../application/contracts/builder-constraints';
import { createPageAction } from '../actions/create-page-action';
import { NEW_PAGE_STEP_FIELDS, NEW_PAGE_STEPS } from '../forms/new-page-steps';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { normalizePagePath } from '../navigation/page-path';
import { builderRoutes } from '../routes';
import { newPageSchema } from '../schemas/new-page-schema';

import type { NewPageStep } from '../forms/new-page-steps';
import type { NewPage } from '../schemas/new-page-schema';
import type { FieldPath } from 'react-hook-form';

/** "Path taken" is reported on the path input, not as a form-level message. */
const CODE_FIELDS: Readonly<Record<string, FieldPath<NewPage>>> = {
  [BUILDER_ERROR_CODES.pagePathTaken]: 'path',
};

/**
 * The "new page" wizard: the path follows the title until the person types their own, a refusal
 * lands on its field (and step) or in the wizard's status, and success replaces the wizard with the
 * new page's editor.
 */
export function useCreatePageForm(websiteId: string, step: NewPageStep) {
  const t = useTranslations('builder');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);

  const form = useForm<NewPage>({
    resolver: zodResolver(newPageSchema),
    defaultValues: { websiteId, title: '', path: '' },
  });
  const { errors, isDirty } = form.formState;
  useReportUnsavedChanges(isDirty);
  const wizard = useWizardSteps({
    steps: NEW_PAGE_STEPS,
    fields: NEW_PAGE_STEP_FIELDS,
    step,
    form,
  });

  /** Follow the title until the user has typed their own path. */
  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    if (form.getFieldState('path').isDirty) {
      return;
    }
    form.setValue('path', normalizePagePath(event.target.value), {
      shouldValidate: form.formState.isSubmitted,
    });
  }

  /** Normalise on blur, not per keystroke, so typing a hyphen or slash is possible. */
  function handlePathBlur(event: ChangeEvent<HTMLInputElement>) {
    form.setValue('path', normalizePagePath(event.target.value), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleSubmit(values: NewPage) {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await createPageAction(values);
      if (!result.ok) {
        setFormErrorCode(applyActionError(result.error, form.setError, CODE_FIELDS));
        const routed = CODE_FIELDS[result.error.code];
        wizard.showErrors(
          routed === undefined ? Object.keys(result.error.fieldErrors ?? {}) : [routed],
        );
        return;
      }
      form.reset(values);
      router.replace(builderRoutes.editor(result.data.websiteId, result.data.id));
    });
  }

  return {
    form,
    errors,
    wizard,
    isPending,
    formErrorCode,
    handleTitleChange,
    handlePathBlur,
    onSubmit: (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!wizard.isLast) {
        void wizard.goNext();
        return;
      }
      void form.handleSubmit(handleSubmit, (invalid) => {
        wizard.showErrors(Object.keys(invalid));
      })(event);
    },
    /** A field's error code as text in this module's language; `undefined` while the field is valid. */
    errorText: (code: string | undefined) =>
      code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS),
  };
}
