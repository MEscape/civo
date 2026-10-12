import { getAppFormatters, getTranslations } from '@i18n/server';

import { toInvitationRowDto } from '../dto/user-dto';
import { ROLE_MESSAGE_KEYS } from '../messages/message-keys';

import { RevokeInvitationButton } from './revoke-invitation-button.client';

import type { InvitationView } from '../../application/contracts/user-views';

export interface OpenInvitationsProps {
  readonly invitations: readonly InvitationView[];
}

/** The invitations nobody has accepted yet, each with a way to withdraw it. */
export async function OpenInvitations({ invitations }: OpenInvitationsProps) {
  const [t, formats] = await Promise.all([getTranslations('auth'), getAppFormatters()]);

  if (invitations.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="invitations-heading" className="space-y-4">
      <h2 id="invitations-heading" className="text-lg font-semibold text-copy">
        {t('users.invitations.title')}
      </h2>
      <ul className="divide-y divide-border rounded-token border border-border">
        {invitations.map((invitation) => {
          const row = toInvitationRowDto(invitation);
          return (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm font-medium text-copy">{row.email}</p>
                <p className="text-xs text-copy-muted">
                  {t(ROLE_MESSAGE_KEYS[invitation.role])} ·{' '}
                  {t('users.invitations.expires', { date: formats.date(row.expiresAt) })}
                </p>
              </div>
              <RevokeInvitationButton invitationId={row.id} email={row.email} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
