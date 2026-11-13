'use client';

import { useState, useTransition } from 'react';

import { useRouter } from '@i18n';

import { markMessagesReadAction } from '../actions/mark-messages-read-action';

import { useBookingWebsite } from './use-booking-website';

/** Marks one message (or, with `null`, all of them) read, then reads the inbox again. */
export function useMarkRead(messageId: string | null) {
  const router = useRouter();
  const websiteId = useBookingWebsite();
  const [isPending, startTransition] = useTransition();
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const markRead = () => {
    startTransition(async () => {
      const result = await markMessagesReadAction({ websiteId, messageId });
      if (!result.ok) {
        setErrorCode(result.error.code);
        return;
      }
      setErrorCode(null);
      router.refresh();
    });
  };

  return { markRead, isPending, errorCode };
}
