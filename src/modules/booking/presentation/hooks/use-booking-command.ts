'use client';

import { useState, useTransition } from 'react';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import type { ActionResult } from '@lib/result';

import { BOOKING_ERROR_CODES as CODES } from '../../application/contracts/booking-constraints';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';

/** Somebody else changed the booking first: what is on screen is old, so it is read again. */
const RACE_CODES: ReadonlySet<string> = new Set([
  CODES.bookingStale,
  CODES.resourceTaken,
  CODES.alreadyAssigned,
]);

export interface CommandOutcome<T> {
  /** After success, with what the server answered; the screen is refreshed in any case. */
  readonly onDone?: (data: T) => void;
  /** After a lost race, once the screen asks the server again. */
  readonly onRace?: () => void;
}

/**
 * Runs one booking action of a manager and says what came of it: success refreshes the screen; a lost
 * race (stale, taken, already assigned) refreshes it too and says the booking changed meanwhile; any
 * other refusal is told by its code, never by its message.
 */
export function useBookingCommand() {
  const t = useTranslations('booking');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run<T>(action: () => Promise<ActionResult<T>>, outcome: CommandOutcome<T> = {}) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setMessage(t('bookings.actions.saved'));
        outcome.onDone?.(result.data);
        router.refresh();
        return;
      }
      if (RACE_CODES.has(result.error.code)) {
        setMessage(t('bookings.actions.refreshed'));
        outcome.onRace?.();
        router.refresh();
        return;
      }
      setMessage(t(messageKeyForCode(result.error.code), MESSAGE_PARAMS));
    });
  }

  return {
    run,
    isPending,
    message,
    clear: () => {
      setMessage(null);
    },
  };
}
