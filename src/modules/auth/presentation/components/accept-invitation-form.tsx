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

import { acceptInvitationAction } from '../actions/accept-invitation-action';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { authRoutes } from '../routes';
import { acceptInvitationSchema } from '../schemas/accept-invitation-schema';

import { AuthLink } from './auth-link';
import { StatusNotice } from './status-notice';

import type { AcceptInvitation } from '../schemas/accept-invitation-schema';

export interface AcceptInvitationFormProps {
  /** The single-use secret of the emailed link. */
  readonly token: string;
}

/** Name and password for an invited person; the address and role were fixed by the invitation. */
export function AcceptInvitationForm({ token }: AcceptInvitationFormProps) {
  const t = useTranslations('auth');
  /** A field's error code as text in this module's language; `undefined` while the field is valid. */
  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);

  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const form = useForm<AcceptInvitation>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: { token, name: '', password: '', confirmPassword: '' },
  });
  const { errors } = form.formState;

  function handleSubmit(values: AcceptInvitation) {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await acceptInvitationAction(values);
      if (result.ok) {
        setIsDone(true);
        return;
      }
      setFormErrorCode(applyActionError(result.error, form.setError));
    });
  }

  if (isDone) {
    return (
      <StatusNotice title={t('acceptInvitation.successTitle')}>
        <p>{t('acceptInvitation.success')}</p>
        <AuthLink href={authRoutes.signIn()}>{t('acceptInvitation.signInLink')}</AuthLink>
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
          label={t('acceptInvitation.name')}
          autoComplete="name"
          error={errorText(errors.name?.message)}
          {...form.register('name')}
        />
        <TextField
          id={`${id}-password`}
          label={t('acceptInvitation.password')}
          hint={t('acceptInvitation.passwordHint', MESSAGE_PARAMS)}
          type="password"
          autoComplete="new-password"
          error={errorText(errors.password?.message)}
          {...form.register('password')}
        />
        <TextField
          id={`${id}-confirm-password`}
          label={t('acceptInvitation.confirmPassword')}
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
          {isPending ? t('acceptInvitation.submitting') : t('acceptInvitation.submit')}
        </Button>
      </form>
    </Card>
  );
}
