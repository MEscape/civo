'use client';

import { MailCheck } from '@components/icons/icons';
import { ProcessSteps } from '@components/shared/process-steps';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { AuthPanel } from '../shared/auth-panel';

import type { AcceptInvitationOutcome } from '../../../application/contracts/invitation-views';

/** Account verification and completed access have separate outcomes in the shared acceptance workflow. */
export function InvitationAccepted({
  status,
  signInPath,
}: {
  readonly status: AcceptInvitationOutcome['status'];
  readonly signInPath: string;
}) {
  const t = useTranslations('auth');
  const isAccepted = status !== 'verify_account';
  const copy = {
    verify_account: ['acceptInvitation.successTitle', 'acceptInvitation.success'],
    accepted: ['acceptInvitation.acceptedTitle', 'acceptInvitation.accepted'],
    already_member: ['acceptInvitation.alreadyMemberTitle', 'acceptInvitation.alreadyMember'],
  } as const;
  return (
    <AuthPanel
      icon={MailCheck}
      tone="success"
      title={t(copy[status][0])}
      description={t(copy[status][1])}
    >
      {!isAccepted && (
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
      )}
      <Link
        href={isAccepted ? '/websites' : signInPath}
        className={buttonVariants({ size: 'lg', className: 'w-full' })}
      >
        {t(isAccepted ? 'acceptInvitation.continue' : 'acceptInvitation.signInLink')}
      </Link>
    </AuthPanel>
  );
}
