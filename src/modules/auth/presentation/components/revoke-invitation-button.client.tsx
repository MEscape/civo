'use client';

import { useState, useTransition } from 'react';

import { Button } from '@components/ui/button';

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
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant="ghost"
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
        {t('users.invitations.revoke', { email })}
      </Button>
      {errorCode !== null && (
        <p role="alert" className="text-xs text-danger">
          {t(messageKeyForCode(errorCode), MESSAGE_PARAMS)}
        </p>
      )}
    </div>
  );
}
