'use client';

import { useId } from 'react';

import { FieldMessage } from '@components/shared/field';
import { Wizard, WizardActions } from '@components/shared/wizard';

import { useTranslations } from '@i18n/client';

import { useInviteUserForm } from '../../hooks/use-invite-user-form';
import { INVITE_STEPS, INVITE_STEP_LABELS } from '../../schemas/invite-user-form-schema';

import { InviteUserFields } from './invite-user-fields.client';

import type { InviteUserFormOptions } from '../../hooks/use-invite-user-form';

/**
 * Invites a person by email into a website or into platform administration, in three steps:
 * the address, the access, and a last look before it is sent.
 */
export function InviteUserForm(props: InviteUserFormOptions) {
  const t = useTranslations('auth');
  const id = useId();
  const screen = useInviteUserForm(props);
  const { wizard } = screen;

  return (
    <form noValidate aria-busy={screen.isPending} onSubmit={screen.onSubmit}>
      <Wizard
        steps={INVITE_STEPS.map((key) => ({ key, label: t(INVITE_STEP_LABELS[key]) }))}
        currentKey={props.step}
        status={<FieldMessage id={`${id}-error`} message={screen.formError} />}
        actions={
          <WizardActions
            cancelHref={props.listHref}
            hasPrevious={wizard.previous !== undefined}
            nextLabel={
              wizard.next === undefined
                ? undefined
                : t('users.invite.next', { step: t(INVITE_STEP_LABELS[wizard.next]) })
            }
            saveLabel={screen.isPending ? t('users.invite.sending') : t('users.invite.submit')}
            isPending={screen.isPending}
            onBack={wizard.goBack}
            onNext={() => {
              void wizard.goNext();
            }}
          />
        }
      >
        <InviteUserFields
          key={props.step}
          id={id}
          step={props.step}
          screen={screen}
          hasTarget={props.websites !== undefined}
          canInvitePlatformAdmin={props.canInvitePlatformAdmin ?? false}
        />
      </Wizard>
    </form>
  );
}
