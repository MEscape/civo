import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel } from '@components/shared/data-panel';
import { Badge } from '@components/ui/badge';
import { Mail } from '@components/ui/icons';

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

  return (
    <DataPanel
      title={t('users.invitations.title')}
      meta={invitations.length > 0 ? formats.number(invitations.length) : undefined}
    >
      {invitations.length === 0 ? (
        <EmptyState
          className="py-10"
          icon={<Mail className="size-6" aria-hidden="true" />}
          title={t('users.invitations.none')}
        />
      ) : (
        <ul className="divide-y divide-border">
          {invitations.map((invitation) => {
            const row = toInvitationRowDto(invitation);
            return (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-medium text-copy">{row.email}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-copy-muted">
                    <Badge variant="outline">{t(ROLE_MESSAGE_KEYS[invitation.role])}</Badge>
                    {t('users.invitations.expires', { date: formats.date(row.expiresAt) })}
                  </p>
                </div>
                <RevokeInvitationButton invitationId={row.id} email={row.email} />
              </li>
            );
          })}
        </ul>
      )}
    </DataPanel>
  );
}
