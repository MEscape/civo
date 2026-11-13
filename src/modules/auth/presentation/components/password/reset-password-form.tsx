'use client';

import { useId } from 'react';

import { ArrowLeft, Lock, ShieldCheck } from '@components/icons/icons';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { useResetPasswordForm } from '../../hooks/use-reset-password-form';
import { authRoutes } from '../../routes';
import { AuthFormAlert } from '../shared/auth-form-alert';
import { AuthLink } from '../shared/auth-link';
import { AuthPanel } from '../shared/auth-panel';
import { AuthSubmitButton } from '../shared/auth-submit-button';

import { NewPasswordFields } from './new-password-fields';

export interface ResetPasswordFormProps {
  /** From the emailed link. Validated by the page and again by the action. */
  readonly token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const t = useTranslations('auth');
  const id = useId();
  const reset = useResetPasswordForm(token);
  const { form, errors, touchedFields, newPassword, confirmPassword, errorText } = reset;

  if (reset.isDone) {
    return (
      <AuthPanel
        icon={ShieldCheck}
        tone="success"
        title={t('resetPassword.successTitle')}
        description={t('resetPassword.success')}
      >
        <Link
          href={authRoutes.signIn()}
          className={buttonVariants({ size: 'lg', className: 'w-full' })}
        >
          {t('resetPassword.signIn')}
        </Link>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      icon={Lock}
      title={t('resetPassword.title')}
      description={t('resetPassword.description')}
      footer={
        <AuthLink href={authRoutes.signIn()} className="inline-flex items-center gap-1.5">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('forgotPassword.backToSignIn')}
        </AuthLink>
      }
    >
      <form
        onSubmit={form.handleSubmit(reset.handleSubmit)}
        noValidate
        aria-busy={reset.isPending}
        className="space-y-5"
      >
        <NewPasswordFields
          id={id}
          passwordLabel={t('resetPassword.newPassword')}
          confirmLabel={t('resetPassword.confirmPassword')}
          passwordRegistration={form.register('newPassword', {
            // The repeat is judged again when the password changes, once the person has been there.
            onChange: () => {
              if (touchedFields.confirmPassword === true) {
                void form.trigger('confirmPassword');
              }
            },
          })}
          confirmRegistration={form.register('confirmPassword')}
          password={newPassword}
          confirmation={confirmPassword}
          passwordError={errorText(errors.newPassword?.message)}
          confirmError={errorText(errors.confirmPassword?.message)}
        />

        <AuthFormAlert id={`${id}-form-error`} message={reset.formError} />

        <AuthSubmitButton
          isPending={reset.isPending}
          label={t('resetPassword.submit')}
          pendingLabel={t('resetPassword.submitting')}
        />
      </form>
    </AuthPanel>
  );
}
