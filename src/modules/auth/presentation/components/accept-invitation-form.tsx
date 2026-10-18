'use client';

import { useId, useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { ProcessSteps } from '@components/shared/process-steps';
import { TextField } from '@components/shared/text-field';
import { buttonVariants } from '@components/ui/button';
import { MailCheck, UserPlus } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { acceptInvitationAction } from '../actions/accept-invitation-action';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { authRoutes } from '../routes';
import { acceptInvitationSchema } from '../schemas/accept-invitation-schema';

import { AuthFormAlert } from './auth-form-alert';
import { AuthPanel } from './auth-panel';
import { AuthSubmitButton } from './auth-submit-button';
import { InvitationSummary } from './invitation-summary';
import { NewPasswordFields } from './new-password-fields';

import type { InvitationSummaryProps } from './invitation-summary';
import type { AcceptInvitation } from '../schemas/accept-invitation-schema';

// @unsaved-work none a one-step form that sets a password; nothing is edited
export interface AcceptInvitationFormProps {
  /** The single-use secret of the emailed link. */
  readonly token: string;
  /** What the invitation offers: shown above the fields, and its address is kept out of the password. */
  readonly invitation: InvitationSummaryProps;
}

/** Name and password for an invited person; the address and role were fixed by the invitation. */
export function AcceptInvitationForm({ token, invitation }: AcceptInvitationFormProps) {
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
    mode: 'onTouched',
    defaultValues: { token, name: '', password: '', confirmPassword: '' },
  });
  const { errors, touchedFields } = form.formState;
  const [name, password, confirmPassword] = useWatch({
    control: form.control,
    name: ['name', 'password', 'confirmPassword'],
  });

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
      <AuthPanel
        icon={MailCheck}
        tone="success"
        title={t('acceptInvitation.successTitle')}
        description={t('acceptInvitation.success')}
      >
        <ProcessSteps
          label={t('acceptInvitation.steps.label')}
          steps={[
            {
              title: t('acceptInvitation.steps.confirm.title'),
              description: t('acceptInvitation.steps.confirm.description'),
            },
            {
              title: t('acceptInvitation.steps.signIn.title'),
              description: t('acceptInvitation.steps.signIn.description'),
            },
          ]}
        />
        <Link
          href={authRoutes.signIn()}
          className={buttonVariants({ size: 'lg', className: 'w-full' })}
        >
          {t('acceptInvitation.signInLink')}
        </Link>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      icon={UserPlus}
      title={t('acceptInvitation.title')}
      description={t('acceptInvitation.description')}
    >
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        noValidate
        aria-busy={isPending}
        className="space-y-5"
      >
        <InvitationSummary {...invitation} />
        <TextField
          id={`${id}-name`}
          label={t('acceptInvitation.name')}
          autoComplete="name"
          isValid={touchedFields.name === true && errors.name === undefined && name.trim() !== ''}
          error={errorText(errors.name?.message)}
          {...form.register('name')}
        />
        <NewPasswordFields
          id={id}
          passwordLabel={t('acceptInvitation.password')}
          confirmLabel={t('acceptInvitation.confirmPassword')}
          passwordRegistration={form.register('password', {
            // The repeat is judged again when the password changes, once the person has been there.
            onChange: () => {
              if (touchedFields.confirmPassword === true) {
                void form.trigger('confirmPassword');
              }
            },
          })}
          confirmRegistration={form.register('confirmPassword')}
          password={password}
          confirmation={confirmPassword}
          passwordError={errorText(errors.password?.message)}
          confirmError={errorText(errors.confirmPassword?.message)}
          personalInputs={[name, invitation.email]}
        />

        <AuthFormAlert
          id={`${id}-form-error`}
          message={
            formErrorCode === null ? null : t(messageKeyForCode(formErrorCode), MESSAGE_PARAMS)
          }
        />

        <AuthSubmitButton
          isPending={isPending}
          label={t('acceptInvitation.submit')}
          pendingLabel={t('acceptInvitation.submitting')}
        />
      </form>
    </AuthPanel>
  );
}
