'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { resetPasswordAction } from '../actions/reset-password-action';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { resetPasswordFormSchema } from '../schemas/reset-password-schema';

import type { ResetPasswordForm as ResetPasswordValues } from '../schemas/reset-password-schema';

// @unsaved-work none a one-step form that sets a password; nothing is edited
/** The state of the reset-password form: its fields, what the server answered, and the submit. */
export function useResetPasswordForm(token: string) {
  const t = useTranslations('auth');
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    mode: 'onTouched',
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const { errors, touchedFields } = form.formState;
  const [newPassword, confirmPassword] = useWatch({
    control: form.control,
    name: ['newPassword', 'confirmPassword'],
  });

  /** A field's error code as text in this module's language; `undefined` while the field is valid. */
  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);

  function handleSubmit(values: ResetPasswordValues) {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await resetPasswordAction({
        token,
        newPassword: values.newPassword,
      });
      if (result.ok) {
        setIsDone(true);
        return;
      }
      setFormErrorCode(applyActionError(result.error, form.setError));
    });
  }

  return {
    form,
    errors,
    touchedFields,
    newPassword,
    confirmPassword,
    isPending,
    isDone,
    formError: formErrorCode === null ? null : t(messageKeyForCode(formErrorCode), MESSAGE_PARAMS),
    errorText,
    handleSubmit,
  };
}
