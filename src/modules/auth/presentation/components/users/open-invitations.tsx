import type { ReactNode } from 'react';

import { Mail } from '@components/icons/icons';
import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel } from '@components/shared/data-panel';
import { Badge } from '@components/ui/badge';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { toInvitationRowDto } from '../../dto/user-dto';
import { ROLE_MESSAGE_KEYS } from '../../messages/message-keys';

import { RevokeInvitationButton } from './revoke-invitation-button.client';

import type { InvitationView } from '../../../application/contracts/user-views';

export interface OpenInvitationsProps {
  readonly invitations: readonly InvitationView[];
  readonly total: number;
  readonly pagination?: ReactNode;
  /** Across websites each invitation names its website; inside one website they all go there. */
  readonly isGlobal: boolean;
}

/** The invitations nobody has accepted yet, each with a way to withdraw it. */
export async function OpenInvitations({
  invitations,
  total,
  pagination,
  isGlobal,
}: OpenInvitationsProps) {
  const [t, formats] = await Promise.all([getTranslations('auth'), getAppFormatters()]);

  return (
    <DataPanel
      title={t('users.invitations.title')}
      meta={t('users.invitations.count', { count: total })}
      footer={pagination}
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
                  <p className="break-all text-sm font-medium text-copy">{row.email}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-copy-muted">
                    <Badge variant="outline">{t(ROLE_MESSAGE_KEYS[invitation.role])}</Badge>
                    {isGlobal && (
                      <span>
                        {invitation.role === 'platform_admin'
                          ? t('users.invite.platformTarget')
                          : (invitation.websiteName ?? invitation.tenantId)}
                      </span>
                    )}
                    <time dateTime={row.expiresAt}>
                      {t('users.invitations.expires', { date: formats.date(row.expiresAt) })}
                    </time>
                  </p>
                </div>
                <RevokeInvitationButton
                  invitationId={row.id}
                  email={row.email}
                  tenantId={invitation.tenantId}
                />
              </li>
            );
          })}
        </ul>
      )}
    </DataPanel>
  );
}
