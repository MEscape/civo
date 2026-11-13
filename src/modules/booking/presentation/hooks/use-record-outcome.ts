'use client';

import { useState, useTransition } from 'react';

import { useRouter } from '@i18n';

import { completeOwnBookingAction } from '../actions/complete-own-booking-action';
import { markOwnBookingNoShowAction } from '../actions/mark-own-booking-no-show-action';

import { useBookingWebsite } from './use-booking-website';

const ACTIONS = {
  completed: completeOwnBookingAction,
  no_show: markOwnBookingNoShowAction,
} as const;

/**
 * Records what became of an appointment of the employee's (it took place, nobody came): the buttons stay
 * out of reach while the server answers, an error keeps its code on screen, success reads the plan again.
 */
export function useRecordOutcome(bookingId: string) {
  const router = useRouter();
  const websiteId = useBookingWebsite();
  const [isPending, startTransition] = useTransition();
  const [errorCode, setErrorCode] = useState<string | null>(null);

  return {
    isPending,
    errorCode,
    record: (outcome: keyof typeof ACTIONS) => {
      setErrorCode(null);
      startTransition(async () => {
        const result = await ACTIONS[outcome]({ websiteId, bookingId });
        if (!result.ok) {
          setErrorCode(result.error.code);
          return;
        }
        router.refresh();
      });
    },
  };
}
