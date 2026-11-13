'use client';

import { TextField } from '@components/shared/field';
import { FormSelectField } from '@components/shared/select-field';

import { useTranslations } from '@i18n/client';

import { ROLE_HINT_KEYS, ROLE_MESSAGE_KEYS } from '../../messages/message-keys';

import type { useInviteUserForm } from '../../hooks/use-invite-user-form';
import type { InviteStep } from '../../schemas/invite-user-form-schema';

interface InviteUserFieldsProps {
  readonly id: string;
  readonly step: InviteStep;
  readonly screen: ReturnType<typeof useInviteUserForm>;
  /** Across websites the person chooses where to invite to; inside one website it is that website. */
  readonly hasTarget: boolean;
  readonly canInvitePlatformAdmin: boolean;
}

/** The entries of one invitation step, or on the last step what will be sent. */
export function InviteUserFields({
  id,
  step,
  screen,
  hasTarget,
  canInvitePlatformAdmin,
}: InviteUserFieldsProps) {
  const t = useTranslations('auth');
  const { form, errorText } = screen;

  if (step === 'person') {
    return (
      <TextField
        id={`${id}-email`}
        label={t('users.invite.email')}
        hint={t('users.invite.emailHint')}
        type="email"
        inputMode="email"
        autoComplete="off"
        error={errorText(form.formState.errors.email?.message)}
        {...form.register('email')}
      />
    );
  }
  if (step === 'access') {
    return (
      <div className="space-y-5">
        {hasTarget && (
          <FormSelectField
            control={form.control}
            name="tenantId"
            id={`${id}-target`}
            label={t('users.invite.target')}
            placeholder={t(
              canInvitePlatformAdmin ? 'users.invite.chooseTarget' : 'users.invite.chooseWebsite',
            )}
            options={screen.targetOptions}
            errorText={errorText}
          />
        )}
        {!screen.isPlatformTarget && (
          <FormSelectField
            control={form.control}
            name="role"
            id={`${id}-role`}
            label={t('users.invite.role')}
            options={screen.roleOptions}
            errorText={errorText}
          />
        )}
      </div>
    );
  }
  const values = form.getValues();
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-y-3">
        <dt className="text-copy-muted">{t('users.invite.email')}</dt>
        <dd className="break-all font-medium text-copy">{values.email}</dd>
        {hasTarget && (
          <>
            <dt className="text-copy-muted">{t('users.invite.target')}</dt>
            <dd className="font-medium text-copy">{screen.targetName}</dd>
          </>
        )}
        {!screen.isPlatformTarget && (
          <>
            <dt className="text-copy-muted">{t('users.invite.role')}</dt>
            <dd className="space-y-1">
              <p className="font-medium text-copy">{t(ROLE_MESSAGE_KEYS[values.role])}</p>
              <p className="text-copy-muted">{t(ROLE_HINT_KEYS[values.role])}</p>
            </dd>
          </>
        )}
      </dl>
      <p className="text-sm text-copy-muted">{t('users.invite.reviewHint')}</p>
    </div>
  );
}
