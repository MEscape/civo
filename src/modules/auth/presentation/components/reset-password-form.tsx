'use client';

import { useId, useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { FieldMessage } from '@components/shared/field-message';
import { TextField } from '@components/shared/text-field';
import { Button } from '@components/ui/button';
import { Card } from '@components/ui/card';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { resetPasswordAction } from '../actions/reset-password-action';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { authRoutes } from '../routes';
import { resetPasswordFormSchema } from '../schemas/reset-password-schema';

import { AuthLink } from './auth-link';
import { StatusNotice } from './status-notice';

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
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const { errors } = form.formState;

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
      <StatusNotice title={t('resetPassword.successTitle')}>
        <p>{t('resetPassword.success')}</p>
        <AuthLink href={authRoutes.signIn()}>{t('resetPassword.signIn')}</AuthLink>
      </StatusNotice>
    );
  }

  return (
    <Card>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        noValidate
        aria-busy={isPending}
        className="space-y-6 p-6"
      >
        <TextField
          id={`${id}-new-password`}
          label={t('resetPassword.newPassword')}
          hint={t('resetPassword.passwordHint', MESSAGE_PARAMS)}
          type="password"
          autoComplete="new-password"
          error={errorText(errors.newPassword?.message)}
          {...form.register('newPassword')}
        />
        <TextField
          id={`${id}-confirm-password`}
          label={t('resetPassword.confirmPassword')}
          type="password"
          autoComplete="new-password"
          error={errorText(errors.confirmPassword?.message)}
          {...form.register('confirmPassword')}
        />

        {formErrorCode !== null && (
          <FieldMessage
            id={`${id}-form-error`}
            message={t(messageKeyForCode(formErrorCode), MESSAGE_PARAMS)}
            className="text-sm"
          />
        )}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? t('resetPassword.submitting') : t('resetPassword.submit')}
        </Button>
      </form>
    </Card>
  );
}
