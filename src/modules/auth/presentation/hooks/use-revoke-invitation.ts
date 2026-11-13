'use client';

import { useRef, useState, useTransition } from 'react';

import { revokeInvitationAction } from '../actions/revoke-invitation-action';

/**
 * Withdrawing an invitation behind a question. The action refreshes the lists, so a withdrawn
 * invitation simply leaves them; a refusal stays beside the row.
 */
export function useRevokeInvitation(invitationId: string, tenantId: string | undefined) {
  const [isAsking, setIsAsking] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const submitting = useRef(false);

  function handleOpen() {
    setErrorCode(null);
    setIsAsking(true);
  }

  function handleCancel() {
    if (!submitting.current) {
      setIsAsking(false);
    }
  }

  function handleConfirm() {
    if (submitting.current) {
      return;
    }
    submitting.current = true;
    setErrorCode(null);
    startTransition(async () => {
      try {
        const result = await revokeInvitationAction({ invitationId, tenantId });
        if (!result.ok) {
          setErrorCode(result.error.code);
        }
        setIsAsking(false);
      } finally {
        submitting.current = false;
      }
    });
  }

  return { isAsking, isPending, errorCode, handleOpen, handleCancel, handleConfirm };
}
