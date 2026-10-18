'use client';

import { useId, useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { buttonVariants } from '@components/ui/button';
import { ArrowLeft, Lock, ShieldCheck } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { resetPasswordAction } from '../actions/reset-password-action';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { authRoutes } from '../routes';
import { resetPasswordFormSchema } from '../schemas/reset-password-schema';

import { AuthFormAlert } from './auth-form-alert';
import { AuthLink } from './auth-link';
import { AuthPanel } from './auth-panel';
import { AuthSubmitButton } from './auth-submit-button';
import { NewPasswordFields } from './new-password-fields';

import type { ResetPasswordForm as ResetPasswordValues } from '../schemas/reset-password-schema';

export interface ResetPasswordFormProps {
  /** From the emailed link. Validated by the page and again by the action. */
  readonly token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const t = useTranslations('auth');
  /** A field's error code as text in this module's language; `undefined` while the field is valid. */
  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);

  const id = useId();
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

  if (isDone) {
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
        onSubmit={form.handleSubmit(handleSubmit)}
        noValidate
        aria-busy={isPending}
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

        <AuthFormAlert
          id={`${id}-form-error`}
          message={
            formErrorCode === null ? null : t(messageKeyForCode(formErrorCode), MESSAGE_PARAMS)
          }
        />

        <AuthSubmitButton
          isPending={isPending}
          label={t('resetPassword.submit')}
          pendingLabel={t('resetPassword.submitting')}
        />
      </form>
    </AuthPanel>
  );
}
