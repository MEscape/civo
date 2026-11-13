'use client';

import { useRef, useState, useTransition } from 'react';

import { rollbackReleaseAction } from '../actions/rollback-release-action';
import { messageKeyForError } from '../messages/message-keys';

import type { MessageKey } from '../messages/message-keys';

/**
 * The confirmed restore of a release: the question's state, the call, and its outcome. A refusal
 * closes the question and stays visible beside the button until it is asked again.
 */
export function useRestoreRelease(websiteId: string, releaseId: string) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [isRestored, setIsRestored] = useState(false);
  const submitting = useRef(false);

  return {
    isConfirming,
    isPending,
    errorKey,
    isRestored,
    open: () => {
      setIsRestored(false);
      setErrorKey(null);
      setIsConfirming(true);
    },
    close: () => {
      if (!submitting.current) {
        setIsConfirming(false);
      }
    },
    confirm: () => {
      if (submitting.current) {
        return;
      }
      submitting.current = true;
      setErrorKey(null);
      startTransition(async () => {
        try {
          const result = await rollbackReleaseAction({ websiteId, releaseId });
          setIsConfirming(false);
          if (result.ok) {
            setIsRestored(true);
          } else {
            setErrorKey(messageKeyForError(result.error));
          }
        } finally {
          submitting.current = false;
        }
      });
    },
  };
}
