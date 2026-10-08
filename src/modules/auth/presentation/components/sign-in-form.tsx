'use client';

import { useId, useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { FieldMessage } from '@components/shared/field-message';
import { TextField } from '@components/shared/text-field';
import { Button } from '@components/ui/button';
import { Card } from '@components/ui/card';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { signInAction } from '../actions/sign-in-action';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { authRoutes } from '../routes';
import { signInSchema } from '../schemas/sign-in-schema';

import { AuthLink } from './auth-link';

import type { SignIn } from '../schemas/sign-in-schema';

export interface SignInFormProps {
  /** Where to go afterwards; the server re-checks it, so this is never trusted. */
  readonly returnTo?: string | undefined;
}

export function SignInForm({ returnTo }: SignInFormProps) {
  const t = useTranslations('auth');
  /** A field's error code as text in this module's language; `undefined` while the field is valid. */
  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);

  const router = useRouter();
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);

  const form = useForm<SignIn>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors } = form.formState;

  function handleSubmit(values: SignIn) {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await signInAction({ ...values, returnTo });
      if (result.ok) {
        router.push(result.data.redirectTo);
        router.refresh();
        return;
      }
      // Keep the email so it can be corrected, but never leave a rejected password behind.
      form.resetField('password');
      setFormErrorCode(applyActionError(result.error, form.setError));
    });
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
          label={t('signIn.email')}
          type="email"
          inputMode="email"
          autoComplete="email"
          error={errorText(errors.email?.message)}
          {...form.register('email')}
        />
        <TextField
          id={`${id}-password`}
          label={t('signIn.password')}
          type="password"
          autoComplete="current-password"
          error={errorText(errors.password?.message)}
          {...form.register('password')}
        />

        {formErrorCode !== null && (
          <FieldMessage
            id={`${id}-form-error`}
            message={t(messageKeyForCode(formErrorCode), MESSAGE_PARAMS)}
            className="text-sm"
          />
        )}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? t('signIn.submitting') : t('signIn.submit')}
        </Button>

        <div className="flex flex-col gap-2">
          <AuthLink href={authRoutes.forgotPassword()}>{t('signIn.forgotPassword')}</AuthLink>
          <p className="text-sm text-copy-muted">
            {t('signIn.noAccount')}{' '}
            <AuthLink href={authRoutes.signUp()}>{t('signIn.createAccount')}</AuthLink>
          </p>
        </div>
      </form>
    </Card>
  );
}
