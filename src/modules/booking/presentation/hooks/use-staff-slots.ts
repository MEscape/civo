'use client';

import { useRef, useState, useTransition } from 'react';

import { getStaffSlotsAction } from '../actions/get-staff-slots-action';

import { useBookingWebsite } from './use-booking-website';

import type { AvailableSlotsDto } from '../dto/booking-dto';

/** Whose free times are asked for: a booking being moved, or a service at a location for a new one. */
export type SlotSource =
  { readonly bookingId: string } | { readonly serviceId: string; readonly locationId: string };

export type SlotsState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly view: AvailableSlotsDto }
  | { readonly kind: 'failed'; readonly code: string };

const isComplete = (source: SlotSource) =>
  'bookingId' in source
    ? source.bookingId !== ''
    : source.serviceId !== '' && source.locationId !== '';

/**
 * A day and one of its free starts, as the scheduling engine answers for a manager. The starts are
 * asked for when the day (or what is booked) changes; an answer to an older question is dropped. The
 * start is sent back exactly as the server wrote it (ISO text with its offset).
 */
export function useStaffSlots(initialDay: string) {
  const websiteId = useBookingWebsite();
  const [day, setDay] = useState(initialDay);
  const [slots, setSlots] = useState<SlotsState>({ kind: 'idle' });
  const [start, setStart] = useState<string | null>(null);
  const [, startLoading] = useTransition();
  const asked = useRef(0);

  function load(nextDay: string, source: SlotSource) {
    asked.current += 1;
    const question = asked.current;
    setDay(nextDay);
    setStart(null);
    if (nextDay === '' || !isComplete(source)) {
      setSlots({ kind: 'idle' });
      return;
    }
    setSlots({ kind: 'loading' });
    startLoading(async () => {
      const result = await getStaffSlotsAction({ websiteId, day: nextDay, ...source });
      if (question !== asked.current) {
        return;
      }
      setSlots(
        result.ok
          ? { kind: 'ready', view: result.data }
          : { kind: 'failed', code: result.error.code },
      );
    });
  }

  return { day, slots, start, choose: setStart, load };
}
