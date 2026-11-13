'use client';

import { useReducer, useState, useTransition } from 'react';

import { useLocale } from '@i18n/client';

import { BOOKING_ERROR_CODES as CODES } from '../../application/contracts/booking-constraints';
import { confirmBookingAction } from '../actions/confirm-booking-action';
import { getAvailableSlotsAction } from '../actions/get-available-slots-action';
import { holdSlotAction } from '../actions/hold-slot-action';
import { releaseHoldAction } from '../actions/release-hold-action';
import { detailsValuesOf } from '../forms/details-schema';
import { initialJourney, journeyReducer, previousOf, stepsOf } from '../forms/journey-state';
import { monthOf } from '../forms/month-calendar';

import { useSlotSearch } from './use-slot-search';

import type { SlotTarget } from './use-slot-search';
import type { PublicBookingDto } from '../dto/booking-dto';
import type { BookingCatalogDto } from '../dto/catalog-dto';
import type { JourneyDetails, JourneyNotice, JourneyState, SlotDto } from '../forms/journey-state';

/** The free days of the first month, read by the server when the journey starts at the calendar. */
export interface InitialMonth {
  readonly month: string;
  readonly days: readonly string[] | null;
}

export interface JourneyInput {
  readonly websiteId: string;
  readonly catalog: BookingCatalogDto;
  readonly initialMonth: InitialMonth | null;
  /** The editor's preview: the journey can be walked through, but nothing is reserved or booked. */
  readonly isPreview?: boolean | undefined;
}

/** The answers that mean "somebody else has this time now": choose another one. */
const TAKEN: ReadonlySet<string> = new Set([
  CODES.slotUnavailable,
  CODES.resourceTaken,
  CODES.capacityExceeded,
]);

const startOf = ({ catalog, initialMonth }: JourneyInput): JourneyState => ({
  ...initialJourney(catalog),
  ...(initialMonth ?? {}),
});

/**
 * The booking journey: the choices in order, each answered by the server when it is made. Choosing
 * a time reserves it at once (BD-27); a reservation that was lost (taken, or run out) brings the
 * visitor back to the times of the day with what they typed kept. One request at a time.
 */
export function useBookingJourney(input: JourneyInput) {
  const { websiteId, catalog } = input;
  const locale = useLocale();
  const search = useSlotSearch((target, span) =>
    getAvailableSlotsAction({ websiteId, ...target, ...span }),
  );
  const [state, dispatch] = useReducer(journeyReducer, input, startOf);
  const [isPending, startTransition] = useTransition();
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const service = catalog.services.find((candidate) => candidate.id === state.serviceId) ?? null;
  const location = catalog.locations.find((candidate) => candidate.id === state.locationId) ?? null;
  const steps = stepsOf(catalog, service);
  const todayAt = (locationId: string) =>
    catalog.locations.find((candidate) => candidate.id === locationId)?.today ?? '';
  const targetOf = (): SlotTarget => ({
    serviceId: state.serviceId ?? '',
    locationId: state.locationId ?? '',
  });

  function run(task: () => Promise<void>) {
    setErrorCode(null);
    startTransition(task);
  }

  function showMonth(target: SlotTarget, month: string) {
    dispatch({ type: 'month', month, days: null });
    run(async () => {
      const answer = await search.freeDays(target, month, todayAt(target.locationId));
      if (answer.ok) {
        dispatch({ type: 'month', month, days: answer.value });
      } else {
        setErrorCode(answer.code);
      }
    });
  }

  function showTimes(target: SlotTarget, day: string) {
    run(async () => {
      const answer = await search.freeTimes(target, day);
      if (answer.ok) {
        dispatch({ type: 'times', times: answer.value });
      } else {
        setErrorCode(answer.code);
      }
    });
  }

  function chooseService(serviceId: string) {
    const chosen = catalog.services.find((candidate) => candidate.id === serviceId);
    const only = chosen?.locationIds.length === 1 ? (chosen.locationIds[0] ?? null) : null;
    dispatch({ type: 'service', serviceId, locationId: only });
    if (only !== null) {
      showMonth({ serviceId, locationId: only }, monthOf(todayAt(only)));
    }
  }

  function chooseLocation(locationId: string) {
    dispatch({ type: 'location', locationId });
    showMonth({ serviceId: state.serviceId ?? '', locationId }, monthOf(todayAt(locationId)));
  }

  function chooseDay(day: string) {
    dispatch({ type: 'day', day });
    showTimes(targetOf(), day);
  }

  function lose(notice: JourneyNotice) {
    dispatch({ type: 'lost', notice });
    if (state.day !== null) {
      showTimes(targetOf(), state.day);
    }
  }

  /** What the booking would look like, for the preview: it exists nowhere. */
  function simulatedBooking(slot: SlotDto, status: 'held' | 'confirmed'): PublicBookingDto | null {
    if (service === null || location === null) {
      return null;
    }
    return {
      websiteId,
      id: 'preview',
      reference: 'PREVIEW',
      status,
      serviceId: service.id,
      serviceName: service.name,
      locationId: location.id,
      locationName: location.name,
      locationAddress: location.address,
      timeZone: location.timeZone,
      start: slot.start,
      end: slot.end,
      holdExpiresAt: null,
      rescheduleCount: 0,
      cancellation: { isAllowed: false, until: null },
      rescheduling: { isAllowed: false, until: null },
    };
  }

  function chooseTime(slot: SlotDto) {
    if (input.isPreview === true) {
      const hold = simulatedBooking(slot, 'held');
      if (hold !== null) {
        dispatch({ type: 'held', hold });
      }
      return;
    }
    const previous = state.hold;
    run(async () => {
      if (previous !== null) {
        // Gives the earlier time back at once instead of when it runs out; its answer changes nothing here.
        await releaseHoldAction({ websiteId, bookingId: previous.id });
      }
      const result = await holdSlotAction({ websiteId, ...targetOf(), start: slot.start, locale });
      if (result.ok) {
        dispatch({ type: 'held', hold: result.data });
      } else if (TAKEN.has(result.error.code)) {
        lose('slot-taken');
      } else {
        setErrorCode(result.error.code);
      }
    });
  }

  function confirm() {
    const { hold } = state;
    if (hold === null || service === null || isPending) {
      return;
    }
    if (input.isPreview === true) {
      dispatch({ type: 'confirmed', booking: { ...hold, status: 'confirmed' } });
      return;
    }
    run(async () => {
      const result = await confirmBookingAction({
        websiteId,
        bookingId: hold.id,
        customer: detailsValuesOf(service, state.details),
      });
      if (result.ok) {
        dispatch({ type: 'confirmed', booking: result.data });
      } else if (result.error.code === CODES.bookingExpired) {
        lose('hold-expired');
      } else if (TAKEN.has(result.error.code)) {
        lose('slot-taken');
      } else {
        setErrorCode(result.error.code);
      }
    });
  }

  return {
    state,
    steps,
    service,
    location,
    isPending,
    errorCode,
    chooseService,
    chooseLocation,
    chooseDay,
    chooseTime,
    confirm,
    showMonth: (month: string) => {
      showMonth(targetOf(), month);
    },
    submitDetails: (details: JourneyDetails) => {
      dispatch({ type: 'details', details });
    },
    back: () => {
      const previous = previousOf(steps, state.step);
      if (previous !== null) {
        dispatch({ type: 'go-to', step: previous });
      }
    },
  };
}

export type BookingJourney = ReturnType<typeof useBookingJourney>;
