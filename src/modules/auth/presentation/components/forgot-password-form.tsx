'use client';

import { useId, useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { ArrowLeft, KeyRound } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { requestPasswordResetAction } from '../actions/request-password-reset-action';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { authRoutes } from '../routes';
import { requestPasswordResetSchema } from '../schemas/request-password-reset-schema';

import { AuthEmailField } from './auth-email-field';
import { AuthFormAlert } from './auth-form-alert';
import { AuthLink } from './auth-link';
import { AuthPanel } from './auth-panel';
import { AuthSubmitButton } from './auth-submit-button';
import { ForgotPasswordSent } from './forgot-password-sent';

import type { RequestPasswordReset } from '../schemas/request-password-reset-schema';

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);

  const id = useId();
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

  // Same confirmation whether or not an account exists.
  if (sentTo !== null) {
    return (
      <ForgotPasswordSent
        email={sentTo}
        onChangeAddress={() => {
          setSentTo(null);
        }}
      />
    );
  }

  return (
    <AuthPanel
      icon={KeyRound}
      title={t('forgotPassword.title')}
      description={t('forgotPassword.description')}
      footer={
        <AuthLink href={authRoutes.signIn()} className="inline-flex items-center gap-1.5">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('forgotPassword.backToSignIn')}
        </AuthLink>
      }
    >
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        noValidate
        aria-busy={isPending}
        className="space-y-5"
      >
        <AuthEmailField
          id={`${id}-email`}
          label={t('forgotPassword.email')}
          registration={form.register('email')}
          value={email}
          error={errorText(errors.email?.message)}
          isTouched={touchedFields.email === true}
          onAccept={(accepted) => {
            form.setValue('email', accepted, { shouldDirty: true, shouldValidate: true });
          }}
        />

        <AuthFormAlert
          id={`${id}-form-error`}
          message={
            formErrorCode === null ? null : t(messageKeyForCode(formErrorCode), MESSAGE_PARAMS)
          }
        />

        <AuthSubmitButton
          isPending={isPending}
          label={t('forgotPassword.submit')}
          pendingLabel={t('forgotPassword.submitting')}
        />
      </form>
    </AuthPanel>
  );
}
