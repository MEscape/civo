'use client';

import { useId } from 'react';

import { UserPlus } from '@components/icons/icons';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { buildQueryString } from '@lib/utils';

import { useAcceptInvitationForm } from '../../hooks/use-accept-invitation-form';
import { authRoutes } from '../../routes';
import { AuthFormAlert } from '../shared/auth-form-alert';
import { AuthPanel } from '../shared/auth-panel';
import { AuthSubmitButton } from '../shared/auth-submit-button';

import { InvitationAccepted } from './invitation-accepted';
import { InvitationAccountFields } from './invitation-account-fields';
import { InvitationSummary } from './invitation-summary';

import type { InvitationSummaryProps } from './invitation-summary';

export interface AcceptInvitationFormProps {
  /** The single-use secret of the emailed link. */
  readonly token: string;
  /** What the invitation offers: shown above the fields, and its address is kept out of the password. */
  readonly invitation: InvitationSummaryProps;
  readonly requiresExistingAccount?: boolean;
  readonly canAcceptExistingAccount?: boolean;
}

/** Name and password for an invited person; the address and role were fixed by the invitation. */
export function AcceptInvitationForm({
  token,
  invitation,
  requiresExistingAccount = false,
  canAcceptExistingAccount = false,
}: AcceptInvitationFormProps) {
  const t = useTranslations('auth');
  const id = useId();
  const accept = useAcceptInvitationForm(token, requiresExistingAccount);
  const { form } = accept;
  const signInPath = authRoutes.signIn(
    `${authRoutes.acceptInvitation()}${buildQueryString({ token })}`,
  );

  if (accept.status !== null) {
    return <InvitationAccepted status={accept.status} signInPath={signInPath} />;
  }

  return (
    <AuthPanel
      icon={UserPlus}
      title={t('acceptInvitation.title')}
      description={t(
        requiresExistingAccount
          ? 'acceptInvitation.existingDescription'
          : 'acceptInvitation.description',
      )}
    >
      <form
        onSubmit={form.handleSubmit(accept.handleSubmit)}
        noValidate
        aria-busy={accept.isPending}
        className="space-y-5"
      >
        <InvitationSummary {...invitation} />
        {!requiresExistingAccount && (
          <InvitationAccountFields id={id} email={invitation.email} accept={accept} />
        )}

        <AuthFormAlert id={`${id}-form-error`} message={accept.formError} />

        {requiresExistingAccount && !canAcceptExistingAccount ? (
          <Link href={signInPath} className={buttonVariants({ size: 'lg', className: 'w-full' })}>
            {t('acceptInvitation.signInLink')}
          </Link>
        ) : (
          <AuthSubmitButton
            isPending={accept.isPending}
            label={t(
              requiresExistingAccount ? 'acceptInvitation.accept' : 'acceptInvitation.submit',
            )}
            pendingLabel={t(
              requiresExistingAccount
                ? 'acceptInvitation.accepting'
                : 'acceptInvitation.submitting',
            )}
          />
        )}
      </form>
    </AuthPanel>
  );
}
