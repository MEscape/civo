'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { requestPasswordResetAction } from '../actions/request-password-reset-action';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { requestPasswordResetSchema } from '../schemas/request-password-reset-schema';

import type { RequestPasswordReset } from '../schemas/request-password-reset-schema';

// @unsaved-work none one e-mail field
/** The state of the forgot-password form: the address, what the server answered, and the submit. */
export function useForgotPasswordForm() {
  const t = useTranslations('auth');
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<RequestPasswordReset>({
    resolver: zodResolver(requestPasswordResetSchema),
    mode: 'onTouched',
    defaultValues: { email: '' },
  });
  const { errors, touchedFields } = form.formState;
  const email = useWatch({ control: form.control, name: 'email' });

  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);

  function handleSubmit(values: RequestPasswordReset) {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await requestPasswordResetAction(values);
      if (result.ok) {
        setSentTo(values.email.trim());
        return;
      }
      setFormErrorCode(applyActionError(result.error, form.setError));
    });
  }

  return {
    form,
    errors,
    touchedFields,
    email,
    isPending,
    sentTo,
    clearSentTo: () => {
      setSentTo(null);
    },
    formError: formErrorCode === null ? null : t(messageKeyForCode(formErrorCode), MESSAGE_PARAMS),
    errorText,
    handleSubmit,
  };
}
