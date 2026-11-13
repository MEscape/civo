'use client';

import { useState, useTransition } from 'react';

import { useRouter } from '@i18n';

import { handBackBookingAction } from '../actions/hand-back-booking-action';

import { useBookingWebsite } from './use-booking-website';

/**
 * Gives a booking back after the employee confirmed it: the dialog stays open while the server
 * answers, an error keeps it open with its code, success closes it and reads the plan again.
 */
export function useHandBack(bookingId: string) {
  const router = useRouter();
  const websiteId = useBookingWebsite();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setOpen] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const confirm = () => {
    startTransition(async () => {
      const result = await handBackBookingAction({ websiteId, bookingId });
      if (!result.ok) {
        setErrorCode(result.error.code);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return {
    isOpen,
    isPending,
    errorCode,
    open: () => {
      setErrorCode(null);
      setOpen(true);
    },
    cancel: () => {
      setOpen(false);
    },
    confirm,
  };
}
