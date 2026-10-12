'use client';

import { useId, useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { FieldMessage } from '@components/shared/field-message';
import { FormSelectField } from '@components/shared/form-select-field';
import { TextField } from '@components/shared/text-field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { ROLES } from '../../application/contracts/auth-constraints';
import { inviteUserAction } from '../actions/invite-user-action';
import { MESSAGE_PARAMS, ROLE_MESSAGE_KEYS, messageKeyForCode } from '../messages/message-keys';
import { inviteUserSchema } from '../schemas/user-admin-schema';

import type { InviteOutcome } from '../../application/contracts/user-views';
import type { z } from 'zod';

type InviteValues = z.infer<typeof inviteUserSchema>;

/** Invites a person by email with one role; an existing account gets the role at once. */
export function InviteUserForm() {
  const t = useTranslations('auth');
  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);

  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<InviteOutcome | null>(null);

  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: { email: '', role: 'viewer' },
  });
  const { errors } = form.formState;

  const roleOptions = ROLES.map((role) => ({ value: role, label: t(ROLE_MESSAGE_KEYS[role]) }));

  function handleSubmit(values: InviteValues) {
    setFormErrorCode(null);
    setOutcome(null);
    startTransition(async () => {
      const result = await inviteUserAction(values);
      if (result.ok) {
        setOutcome(result.data);
        form.reset({ email: '', role: values.role });
        return;
      }
      setFormErrorCode(applyActionError(result.error, form.setError));
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      noValidate
      aria-busy={isPending}
      className="grid grid-cols-1 items-start gap-4 sm:grid-cols-4"
    >
      <TextField
        id={`${id}-email`}
        label={t('users.invite.email')}
        type="email"
        inputMode="email"
        autoComplete="off"
        error={errorText(errors.email?.message)}
        {...form.register('email')}
      />
      <FormSelectField
        control={form.control}
        name="role"
        id={`${id}-role`}
        label={t('users.invite.role')}
        options={roleOptions}
        errorText={errorText}
      />
      <Button type="submit" disabled={isPending} className="sm:mt-6">
        {isPending ? t('users.invite.sending') : t('users.invite.submit')}
      </Button>

      <div className="sm:col-span-3" role="status">
        {outcome !== null && (
          <p className="text-sm text-copy">{t(`users.invite.outcome.${outcome}`)}</p>
        )}
        {formErrorCode !== null && (
          <FieldMessage
            id={`${id}-form-error`}
            message={t(messageKeyForCode(formErrorCode), MESSAGE_PARAMS)}
            className="text-sm"
          />
        )}
      </div>
    </form>
  );
}
