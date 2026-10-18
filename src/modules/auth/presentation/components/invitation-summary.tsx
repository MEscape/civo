'use client';

import { Badge } from '@components/ui/badge';

import { useAppFormatters, useTranslations } from '@i18n/client';

import { ROLE_MESSAGE_KEYS } from '../messages/message-keys';

import type { InvitationRole } from '../../application/contracts/auth-constraints';

export interface InvitationSummaryProps {
  /** The address the invitation was sent to: the account will have it, and it cannot be changed here. */
  readonly email: string;
  readonly role: InvitationRole;
  /** The website the person is invited to; `null` for an invitation that is not for one. */
  readonly organisation: string | null;
  /** When the link stops working (ISO). */
  readonly expiresAt: string;
}

/** What the person is joining, above the form that creates their account: whose website, as whom, until when. */
export function InvitationSummary({
  email,
  role,
  organisation,
  expiresAt,
}: InvitationSummaryProps) {
  const t = useTranslations('auth');
  const format = useAppFormatters();

  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 rounded-token border border-border bg-canvas p-4 text-sm">
      {organisation !== null && (
        <>
          <dt className="text-copy-muted">{t('acceptInvitation.invitation.organisation')}</dt>
          <dd className="font-medium break-words text-copy">{organisation}</dd>
        </>
      )}
      <dt className="text-copy-muted">{t('acceptInvitation.invitation.email')}</dt>
      <dd className="font-medium break-all text-copy">{email}</dd>
      <dt className="text-copy-muted">{t('acceptInvitation.invitation.role')}</dt>
      <dd>
        <Badge variant="outline">{t(ROLE_MESSAGE_KEYS[role])}</Badge>
      </dd>
      <dt className="text-copy-muted">{t('acceptInvitation.invitation.expires')}</dt>
      <dd className="text-copy">{format.date(expiresAt)}</dd>
    </dl>
  );
}
