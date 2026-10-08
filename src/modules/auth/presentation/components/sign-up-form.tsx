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
import { signUpAction } from '../actions/sign-up-action';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { authRoutes } from '../routes';
import { signUpSchema } from '../schemas/sign-up-schema';

import { AuthLink } from './auth-link';
import { StatusNotice } from './status-notice';

import type { SignUp } from '../schemas/sign-up-schema';

const SECONDS_PER_MINUTE = 60;
const LINK_LIFETIME_MINUTES = AUTH_LINK_LIFETIME_SECONDS / SECONDS_PER_MINUTE;

export function SignUpForm() {
  const t = useTranslations('auth');
  /** A field's error code as text in this module's language; `undefined` while the field is valid. */
  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);

  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const form = useForm<SignUp>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });
  const { errors } = form.formState;

  function handleSubmit(values: SignUp) {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await signUpAction(values);
      if (result.ok) {
        setIsDone(true);
        return;
      }
      setFormErrorCode(applyActionError(result.error, form.setError));
    });
  }

  // Same confirmation for new and existing addresses: it must not reveal which one this was.
  if (isDone) {
    return (
      <StatusNotice title={t('signUp.successTitle')}>
        <p>{t('signUp.success', { minutes: LINK_LIFETIME_MINUTES })}</p>
        <AuthLink href={authRoutes.signIn()}>{t('signUp.signInLink')}</AuthLink>
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
          id={`${id}-name`}
          label={t('signUp.name')}
          autoComplete="name"
          error={errorText(errors.name?.message)}
          {...form.register('name')}
        />
        <TextField
          id={`${id}-email`}
          label={t('signUp.email')}
          type="email"
          inputMode="email"
          autoComplete="email"
          error={errorText(errors.email?.message)}
          {...form.register('email')}
        />
        <TextField
          id={`${id}-password`}
          label={t('signUp.password')}
          hint={t('signUp.passwordHint', MESSAGE_PARAMS)}
          type="password"
          autoComplete="new-password"
          error={errorText(errors.password?.message)}
          {...form.register('password')}
        />
        <TextField
          id={`${id}-confirm-password`}
          label={t('signUp.confirmPassword')}
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
          {isPending ? t('signUp.submitting') : t('signUp.submit')}
        </Button>

        <p className="text-sm text-copy-muted">
          {t('signUp.hasAccount')}{' '}
          <AuthLink href={authRoutes.signIn()}>{t('signUp.signInLink')}</AuthLink>
        </p>
      </form>
    </Card>
  );
}
