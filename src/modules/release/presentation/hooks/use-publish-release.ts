'use client';

import { useRef, useState, useTransition } from 'react';

import { publishReleaseAction } from '../actions/publish-release-action';
import { messageKeyForError } from '../messages/message-keys';

import type { MessageKey } from '../messages/message-keys';

/**
 * The confirmed publish: the review's state, its note, the call and its outcome. A refusal keeps
 * the review open with the note, so it can be sent again; a second press while one is on its way
 * sends nothing.
 */
export function usePublishRelease(websiteId: string) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState('');
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [publishedNumber, setPublishedNumber] = useState<number | null>(null);
  const submitting = useRef(false);

  return {
    isConfirming,
    isPending,
    note,
    setNote,
    errorKey,
    publishedNumber,
    open: () => {
      setPublishedNumber(null);
      setErrorKey(null);
      setIsConfirming(true);
    },
    close: () => {
      if (!submitting.current) {
        setErrorKey(null);
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
          const result = await publishReleaseAction({ websiteId, note });
          if (!result.ok) {
            setErrorKey(messageKeyForError(result.error));
            return;
          }
          setPublishedNumber(result.data.releaseNumber);
          setNote('');
          setIsConfirming(false);
        } finally {
          submitting.current = false;
        }
      });
    },
  };
}
