'use client';

import { TextField } from '@components/shared/field';

import { useTranslations } from '@i18n/client';

import { NewPasswordFields } from '../password/new-password-fields';

import type { useAcceptInvitationForm } from '../../hooks/use-accept-invitation-form';

/** New-account fields stay within the same invitation form; existing accounts do not change credentials. */
export function InvitationAccountFields({
  id,
  email,
  accept,
}: {
  readonly id: string;
  readonly email: string;
  readonly accept: ReturnType<typeof useAcceptInvitationForm>;
}) {
  const t = useTranslations('auth');
  const { form, errors, touchedFields, name, password, confirmPassword, errorText } = accept;
  return (
    <>
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
        personalInputs={[name, email]}
      />
    </>
  );
}
