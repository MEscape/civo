'use client';

import { useId } from 'react';

import { ArrowLeft, KeyRound } from '@components/icons/icons';

import { useTranslations } from '@i18n/client';

import { useForgotPasswordForm } from '../../hooks/use-forgot-password-form';
import { authRoutes } from '../../routes';
import { AuthEmailField } from '../shared/auth-email-field';
import { AuthFormAlert } from '../shared/auth-form-alert';
import { AuthLink } from '../shared/auth-link';
import { AuthPanel } from '../shared/auth-panel';
import { AuthSubmitButton } from '../shared/auth-submit-button';

import { ForgotPasswordSent } from './forgot-password-sent';

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const id = useId();
  const forgot = useForgotPasswordForm();
  const { form, errors, touchedFields, email, errorText } = forgot;

  // Same confirmation whether or not an account exists.
  if (forgot.sentTo !== null) {
    return <ForgotPasswordSent email={forgot.sentTo} onChangeAddress={forgot.clearSentTo} />;
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
        onSubmit={form.handleSubmit(forgot.handleSubmit)}
        noValidate
        aria-busy={forgot.isPending}
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

        <AuthFormAlert id={`${id}-form-error`} message={forgot.formError} />

        <AuthSubmitButton
          isPending={forgot.isPending}
          label={t('forgotPassword.submit')}
          pendingLabel={t('forgotPassword.submitting')}
        />
      </form>
    </AuthPanel>
  );
}
