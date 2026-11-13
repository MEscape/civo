'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { acceptInvitationAction } from '../actions/accept-invitation-action';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { acceptInvitationSchema } from '../schemas/accept-invitation-schema';

import type { AcceptInvitationOutcome } from '../../application/contracts/invitation-views';
import type { AcceptInvitation } from '../schemas/accept-invitation-schema';

// @unsaved-work none a one-step form that sets a password; nothing is edited
/** The state of the accept-invitation form: its fields, what the server answered, and the submit. */
export function useAcceptInvitationForm(token: string, requiresExistingAccount = false) {
  const t = useTranslations('auth');
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [status, setStatus] = useState<AcceptInvitationOutcome['status'] | null>(null);

  const form = useForm<AcceptInvitation>({
    resolver: zodResolver(acceptInvitationSchema),
    mode: 'onTouched',
    defaultValues: requiresExistingAccount
      ? { token }
      : { token, name: '', password: '', confirmPassword: '' },
  });
  const { errors, touchedFields } = form.formState;
  const [name, password, confirmPassword] = useWatch({
    control: form.control,
    name: ['name', 'password', 'confirmPassword'],
  });

  /** A field's error code as text in this module's language; `undefined` while the field is valid. */
  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);

  function handleSubmit(values: AcceptInvitation) {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await acceptInvitationAction(values);
      if (result.ok) {
        setStatus(result.data.status);
        return;
      }
      setFormErrorCode(applyActionError(result.error, form.setError));
    });
  }

  return {
    form,
    errors,
    touchedFields,
    name: name ?? '',
    password: password ?? '',
    confirmPassword: confirmPassword ?? '',
    status,
    isPending,
    isDone: status !== null,
    formError: formErrorCode === null ? null : t(messageKeyForCode(formErrorCode), MESSAGE_PARAMS),
    errorText,
    handleSubmit,
  };
}
