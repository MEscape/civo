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
import { slugify } from '@lib/utils';

import {
  TEMPLATE_KEYS,
  WEBSITE_ERROR_CODES,
} from '../../application/contracts/website-constraints';
import { createWebsiteAction } from '../actions/create-website-action';
import { NEW_WEBSITE_STEP_FIELDS, NEW_WEBSITE_STEPS } from '../forms/new-website-steps';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { websiteRoutes } from '../routes';
import { newWebsiteSchema } from '../schemas/new-website-schema';

import type { NewWebsiteStep } from '../forms/new-website-steps';
import type { NewWebsite } from '../schemas/new-website-schema';
import type { FieldPath } from 'react-hook-form';

const DEFAULT_TEMPLATE_KEY = TEMPLATE_KEYS[0];

/** "Slug taken" is reported on the slug input, not as a form-level message. */
const CODE_FIELDS: Readonly<Record<string, FieldPath<NewWebsite>>> = {
  [WEBSITE_ERROR_CODES.slugTaken]: 'slug',
};

/**
 * The "new website" wizard: the slug follows the name until the person types their own, each step
 * validates its own fields, a refusal lands on its field (and step) or in the wizard's status, and
 * success replaces the wizard with the new website's overview, whose checklist names the next steps.
 */
export function useCreateWebsiteForm(step: NewWebsiteStep) {
  const t = useTranslations('website');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);

  const form = useForm<NewWebsite>({
    resolver: zodResolver(newWebsiteSchema),
    defaultValues: { name: '', slug: '', templateKey: DEFAULT_TEMPLATE_KEY },
  });
  const { errors, isDirty } = form.formState;
  useReportUnsavedChanges(isDirty);
  const wizard = useWizardSteps({
    steps: NEW_WEBSITE_STEPS,
    fields: NEW_WEBSITE_STEP_FIELDS,
    step,
    form,
  });

  /** Follow the name until the user has typed their own slug. */
  function handleNameChange(event: ChangeEvent<HTMLInputElement>) {
    if (form.getFieldState('slug').isDirty) {
      return;
    }
    form.setValue('slug', slugify(event.target.value), {
      shouldValidate: form.formState.isSubmitted,
    });
  }

  /** Normalise on blur, not per keystroke, so typing a hyphen is possible. */
  function handleSlugBlur(event: ChangeEvent<HTMLInputElement>) {
    form.setValue('slug', slugify(event.target.value), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleSubmit(values: NewWebsite) {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await createWebsiteAction(values);
      if (!result.ok) {
        setFormErrorCode(applyActionError(result.error, form.setError, CODE_FIELDS));
        const routed = CODE_FIELDS[result.error.code];
        wizard.showErrors(
          routed === undefined ? Object.keys(result.error.fieldErrors ?? {}) : [routed],
        );
        return;
      }
      form.reset(values);
      router.replace(websiteRoutes.detail(result.data.id));
    });
  }

  return {
    form,
    errors,
    wizard,
    isPending,
    formErrorCode,
    handleNameChange,
    handleSlugBlur,
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
