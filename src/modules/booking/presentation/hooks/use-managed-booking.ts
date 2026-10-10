import { useState, useTransition } from 'react';

import type { ActionResult } from '@lib/result';

import { cancelOwnBookingAction } from '../actions/cancel-own-booking-action';
import { findBookingAction } from '../actions/find-booking-action';
import { rescheduleOwnBookingAction } from '../actions/reschedule-own-booking-action';

import type { SlotDto } from '../dto/availability-dto';
import type { BookingDto } from '../dto/booking-dto';

export type ManageMode = 'view' | 'confirm-cancel' | 'reschedule';

export interface ManagedBooking {
  readonly booking: BookingDto | null;
  readonly mode: ManageMode;
  readonly slot: SlotDto | null;
  readonly errorCode: string | null;
  readonly isPending: boolean;
  readonly setSlot: (slot: SlotDto | null) => void;
  /** Switches the panel and clears the last error, so a stale message does not follow the visitor. */
  readonly goTo: (mode: ManageMode) => void;
  readonly lookUp: (reference: string, email: string) => void;
  readonly cancel: () => void;
  readonly move: (slot: SlotDto) => void;
}

/**
 * The visitor's own booking: found with reference AND e-mail address, then
 * cancelled or moved. The address that found it is kept, because the server
 * asks for it again on every change.
 */
export function useManagedBooking(
  websiteId: string,
  initial: { readonly booking: BookingDto; readonly email: string } | null,
): ManagedBooking {
  const [booking, setBooking] = useState<BookingDto | null>(initial?.booking ?? null);
  const [accessEmail, setAccessEmail] = useState(initial?.email ?? '');
  const [mode, setMode] = useState<ManageMode>('view');
  const [slot, setSlot] = useState<SlotDto | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /** Runs one server action; a success updates the booking, a failure shows its code. */
  function run(
    action: () => Promise<ActionResult<BookingDto>>,
    onDone: (booking: BookingDto) => void,
  ) {
    setErrorCode(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setBooking(result.data);
        setMode('view');
        onDone(result.data);
      } else {
        setErrorCode(result.error.code);
      }
    });
  }

  return {
    booking,
    mode,
    slot,
    errorCode,
    isPending,
    setSlot,
    goTo: (next) => {
      setErrorCode(null);
      setMode(next);
      if (next === 'view') {
        setSlot(null);
      }
    },
    lookUp: (reference, email) => {
      run(
        () => findBookingAction({ websiteId, reference, email }),
        () => {
          setAccessEmail(email);
        },
      );
    },
    cancel: () => {
      if (booking !== null) {
        run(
          () =>
            cancelOwnBookingAction({ websiteId, reference: booking.reference, email: accessEmail }),
          () => undefined,
        );
      }
    },
    move: (chosen) => {
      if (booking !== null) {
        run(
          () =>
            rescheduleOwnBookingAction({
              websiteId,
              reference: booking.reference,
              email: accessEmail,
              start: chosen.start,
            }),
          () => {
            setSlot(null);
          },
        );
      }
    },
  };
}
