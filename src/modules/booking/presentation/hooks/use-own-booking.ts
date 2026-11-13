'use client';

import { useState, useTransition } from 'react';

import { BOOKING_ERROR_CODES as CODES } from '../../application/contracts/booking-constraints';
import { cancelOwnBookingAction } from '../actions/cancel-own-booking-action';
import { getOwnBookingSlotsAction } from '../actions/get-own-booking-slots-action';
import { rescheduleOwnBookingAction } from '../actions/reschedule-own-booking-action';
import { monthOf } from '../forms/month-calendar';

import { useSlotSearch } from './use-slot-search';

import type { FoundBooking } from './use-booking-lookup';
import type { SlotDto } from '../forms/journey-state';

/** What the visitor last did with their booking, to say so. */
export type OwnOutcome = 'cancelled' | 'moved';

/** The new time being chosen: the month on screen and its free days, the day and its free times. */
interface MovePicker {
  readonly month: string;
  readonly days: readonly string[] | null;
  readonly day: string | null;
  readonly times: readonly SlotDto[] | null;
}

const TAKEN: ReadonlySet<string> = new Set([CODES.slotUnavailable, CODES.resourceTaken]);

/**
 * "My booking" once found: cancel it, or move it to a free time of the same service at the same
 * place. Each change names the booking by its reference and address again, and the service's
 * policy is the server's to apply; a time taken meanwhile leaves the booking where it was and the
 * day's times are read again.
 */
export function useOwnBooking(websiteId: string, initial: FoundBooking, today: string) {
  const [found, setFound] = useState(initial);
  // The move's own question: the booking does not hide its own time (`GetOwnBookingSlots`).
  const search = useSlotSearch((_target, span) =>
    getOwnBookingSlotsAction({
      websiteId,
      reference: found.booking.reference,
      email: found.email,
      ...span,
    }),
  );
  const [outcome, setOutcome] = useState<OwnOutcome | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [picker, setPicker] = useState<MovePicker | null>(null);
  const [isPending, startTransition] = useTransition();
  const { booking, email } = found;
  const target = { serviceId: booking.serviceId, locationId: booking.locationId };
  const key = { websiteId, reference: booking.reference, email };

  function run(task: () => Promise<void>) {
    setErrorCode(null);
    startTransition(task);
  }

  function showMonth(month: string) {
    setPicker({ month, days: null, day: null, times: null });
    run(async () => {
      const answer = await search.freeDays(target, month, today);
      setPicker({ month, days: answer.ok ? answer.value : [], day: null, times: null });
      if (!answer.ok) {
        setErrorCode(answer.code);
      }
    });
  }

  function showDay(day: string) {
    setPicker((current) => current && { ...current, day, times: null });
    run(async () => {
      const answer = await search.freeTimes(target, day);
      setPicker((current) => current && { ...current, times: answer.ok ? answer.value : [] });
      if (!answer.ok) {
        setErrorCode(answer.code);
      }
    });
  }

  function cancel() {
    run(async () => {
      const result = await cancelOwnBookingAction(key);
      if (result.ok) {
        setFound({ booking: result.data, email });
        setOutcome('cancelled');
      } else {
        setErrorCode(result.error.code);
      }
    });
  }

  function move(slot: SlotDto) {
    run(async () => {
      const result = await rescheduleOwnBookingAction({ ...key, start: slot.start });
      if (result.ok) {
        setFound({ booking: result.data, email });
        setPicker(null);
        setOutcome('moved');
        return;
      }
      if (TAKEN.has(result.error.code) && picker !== null && picker.day !== null) {
        showDay(picker.day);
      }
      setErrorCode(result.error.code);
    });
  }

  return {
    booking,
    outcome,
    errorCode,
    picker,
    isPending,
    cancel,
    move,
    showDay,
    showMonth,
    startMove: () => {
      setOutcome(null);
      showMonth(monthOf(today));
    },
    stopMove: () => {
      setPicker(null);
    },
  };
}
