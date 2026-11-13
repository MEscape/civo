'use client';

import { useState, useTransition } from 'react';

import { useRouter } from '@i18n';

import { BOOKING_ERROR_CODES } from '../../application/contracts/booking-constraints';
import { claimBookingAction } from '../actions/claim-booking-action';

import { useBookingWebsite } from './use-booking-website';

/** `taken`: somebody else was first (`booking.already_assigned`); the row says so and offers nothing. */
export type ClaimOutcome =
  | { readonly kind: 'idle' }
  | { readonly kind: 'claimed' }
  | { readonly kind: 'taken' }
  | { readonly kind: 'failed'; readonly code: string };

/**
 * Takes one open booking and keeps what the server answered: success only on `ok`, a lost race as
 * "taken" from the claim's own answer (BD-22). The row keeps showing the answer (re-reading the list
 * at once would take the row, and what it says, away); `refresh` reads the list again on request.
 */
export function useClaim(bookingId: string) {
  const router = useRouter();
  const websiteId = useBookingWebsite();
  const [isPending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<ClaimOutcome>({ kind: 'idle' });

  const claim = () => {
    startTransition(async () => {
      const result = await claimBookingAction({ websiteId, bookingId });
      if (result.ok) {
        setOutcome({ kind: 'claimed' });
      } else if (result.error.code === BOOKING_ERROR_CODES.alreadyAssigned) {
        setOutcome({ kind: 'taken' });
      } else {
        setOutcome({ kind: 'failed', code: result.error.code });
      }
    });
  };

  return {
    claim,
    isPending,
    outcome,
    refresh: () => {
      router.refresh();
    },
  };
}
