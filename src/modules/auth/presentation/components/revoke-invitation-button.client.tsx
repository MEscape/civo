'use client';

import { useState, useTransition } from 'react';

import { Button } from '@components/ui/button';
import { Trash2 } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { revokeInvitationAction } from '../actions/revoke-invitation-action';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';

export interface RevokeInvitationButtonProps {
  readonly invitationId: string;
  readonly email: string;
}

/** Withdraws a pending invitation, so its link stops working. */
export function RevokeInvitationButton({ invitationId, email }: RevokeInvitationButtonProps) {
  const t = useTranslations('auth');
  const [isPending, startTransition] = useTransition();
  const [errorCode, setErrorCode] = useState<string | null>(null);

  return (
    <div className="shrink-0 space-y-1 text-right">
      <Button
        type="button"
        size="sm"
        variant="destructive-ghost"
        disabled={isPending}
        onClick={() => {
          setErrorCode(null);
          startTransition(async () => {
            const result = await revokeInvitationAction({ invitationId });
            if (!result.ok) {
              setErrorCode(result.error.code);
            }
          });
        }}
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        <span aria-hidden="true">{t('users.invitations.withdraw')}</span>
        <span className="sr-only">{t('users.invitations.revoke', { email })}</span>
      </Button>
      {errorCode !== null && (
        <p role="alert" className="text-xs text-danger">
          {t(messageKeyForCode(errorCode), MESSAGE_PARAMS)}
        </p>
      )}
    </div>
  );
}
