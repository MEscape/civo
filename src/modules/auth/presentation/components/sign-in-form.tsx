'use client';

import { useId, useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { PasswordField } from '@components/shared/password-field';
import { Alert } from '@components/ui/alert';
import { Info, Lock } from '@components/ui/icons';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { signInAction } from '../actions/sign-in-action';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { authRoutes } from '../routes';
import { signInSchema } from '../schemas/sign-in-schema';

import { AuthEmailField } from './auth-email-field';
import { AuthFormAlert } from './auth-form-alert';
import { AuthLink } from './auth-link';
import { AuthPanel } from './auth-panel';
import { AuthSubmitButton } from './auth-submit-button';

import type { SignIn } from '../schemas/sign-in-schema';

// @unsaved-work none credentials; nothing worth keeping
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

  // A field is checked when it is left and again on every key after that: errors appear before submitting.
  const form = useForm<SignIn>({
    resolver: zodResolver(signInSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });
  const { errors, touchedFields } = form.formState;
  const email = useWatch({ control: form.control, name: 'email' });

  function handleSubmit(values: SignIn) {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await signInAction({ ...values, returnTo });
      if (result.ok) {
        // The action revalidated the layout, so the destination is fetched fresh: no extra refresh.
        router.push(result.data.redirectTo);
        return;
      }
      // Keep the email so it can be corrected, but never leave a rejected password behind.
      form.resetField('password');
      setFormErrorCode(applyActionError(result.error, form.setError));
      form.setFocus('password');
    });
  }

  return (
    <AuthPanel
      icon={Lock}
      title={t('signIn.title')}
      description={t('signIn.description')}
      footer={t('signIn.byInvitation')}
    >
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        noValidate
        aria-busy={isPending}
        className="space-y-5"
      >
        {returnTo !== undefined && (
          <Alert variant="info" role="status">
            <Info className="size-4" aria-hidden="true" />
            <div className="text-sm">{t('signIn.continueNotice')}</div>
          </Alert>
        )}
        <AuthEmailField
          id={`${id}-email`}
          label={t('signIn.email')}
          registration={form.register('email')}
          value={email}
          error={errorText(errors.email?.message)}
          isTouched={touchedFields.email === true}
          onAccept={(accepted) => {
            form.setValue('email', accepted, { shouldDirty: true, shouldValidate: true });
          }}
        />
        <PasswordField
          id={`${id}-password`}
          label={t('signIn.password')}
          autoComplete="current-password"
          labelAction={
            <AuthLink href={authRoutes.forgotPassword()} className="text-xs">
              {t('signIn.forgotPassword')}
            </AuthLink>
          }
          error={errorText(errors.password?.message)}
          {...form.register('password')}
        />

        <AuthFormAlert
          id={`${id}-form-error`}
          message={
            formErrorCode === null ? null : t(messageKeyForCode(formErrorCode), MESSAGE_PARAMS)
          }
        />

        <AuthSubmitButton
          isPending={isPending}
          label={t('signIn.submit')}
          pendingLabel={t('signIn.submitting')}
        />
      </form>
    </AuthPanel>
  );
}
