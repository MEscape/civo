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

import { AUTH_LINK_LIFETIME_SECONDS } from '../../application/contracts/auth-constraints';
import { requestPasswordResetAction } from '../actions/request-password-reset-action';
import { authRoutes } from '../routes';
import { requestPasswordResetSchema } from '../schemas/request-password-reset-schema';

import { AuthLink } from './auth-link';
import { StatusNotice } from './status-notice';

import type { RequestPasswordReset } from '../schemas/request-password-reset-schema';

const SECONDS_PER_MINUTE = 60;
const LINK_LIFETIME_MINUTES = AUTH_LINK_LIFETIME_SECONDS / SECONDS_PER_MINUTE;

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const form = useForm<RequestPasswordReset>({
    resolver: zodResolver(requestPasswordResetSchema),
    defaultValues: { email: '' },
  });
  const { errors } = form.formState;

  function handleSubmit(values: RequestPasswordReset) {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await requestPasswordResetAction(values);
      if (result.ok) {
        setIsDone(true);
        return;
      }
      setFormErrorCode(applyActionError(result.error, form.setError));
    });
  }

  // Same confirmation whether or not an account exists.
  if (isDone) {
    return (
      <StatusNotice title={t('forgotPassword.successTitle')}>
        <p>{t('forgotPassword.success', { minutes: LINK_LIFETIME_MINUTES })}</p>
        <AuthLink href={authRoutes.signIn()}>{t('forgotPassword.backToSignIn')}</AuthLink>
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
          id={`${id}-email`}
          label={t('forgotPassword.email')}
          type="email"
          inputMode="email"
          autoComplete="email"
          error={errors.email?.message}
          {...form.register('email')}
        />

        {formErrorCode !== null && (
          <FieldMessage id={`${id}-form-error`} message={formErrorCode} className="text-sm" />
        )}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
        </Button>

        <AuthLink href={authRoutes.signIn()}>{t('forgotPassword.backToSignIn')}</AuthLink>
      </form>
    </Card>
  );
}
