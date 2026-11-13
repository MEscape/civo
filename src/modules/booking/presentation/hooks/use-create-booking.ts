'use client';

import { useState } from 'react';

import { useRouter } from '@i18n';

import { createBookingAsStaffAction } from '../actions/create-booking-as-staff-action';
import { bookingDetailsHref } from '../forms/booking-list-href';

import { useBookingCommand } from './use-booking-command';
import { useBookingWebsite } from './use-booking-website';
import { useStaffSlots } from './use-staff-slots';

/** What the person who calls or walks in is asked for; the service decides what is required. */
export interface WalkInCustomer {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
}

const NOBODY: WalkInCustomer = { firstName: '', lastName: '', email: '', phone: '' };
const NOWHERE = { serviceId: '', locationId: '' };

/**
 * "Buchung anlegen": a service, a location, a free start from the engine and who it is for. Each
 * opening of the dialog is one attempt with its own request key, so a double click or a lost answer
 * meets the booking the first try made instead of making a second. On success the list opens on the
 * new booking's day with its details.
 */
export function useCreateBooking(options: { readonly today: string; readonly listHref: string }) {
  const router = useRouter();
  const websiteId = useBookingWebsite();
  const [isOpen, setIsOpen] = useState(false);
  const [place, setPlace] = useState(NOWHERE);
  const [customer, setCustomer] = useState<WalkInCustomer>(NOBODY);
  const [requestKey, setRequestKey] = useState('');
  const picker = useStaffSlots(options.today);
  const command = useBookingCommand();

  function choose(change: Partial<typeof place>) {
    const next = { ...place, ...change };
    setPlace(next);
    picker.load(picker.day, next);
  }

  function create() {
    const start = picker.start;
    if (start === null) {
      return;
    }
    command.run(
      () => createBookingAsStaffAction({ websiteId, ...place, start, customer, requestKey }),
      {
        onDone: (booking) => {
          setIsOpen(false);
          router.push(bookingDetailsHref(options.listHref, booking));
        },
        onRace: () => {
          picker.load(picker.day, place);
        },
      },
    );
  }

  return {
    isOpen,
    place,
    customer,
    picker,
    command,
    choose,
    setCustomer: (change: Partial<WalkInCustomer>) => {
      setCustomer({ ...customer, ...change });
    },
    open: () => {
      command.clear();
      // Each opening starts over: no service, location, day or start left from the last attempt.
      setPlace(NOWHERE);
      picker.load(options.today, NOWHERE);
      setCustomer(NOBODY);
      setRequestKey(crypto.randomUUID());
      setIsOpen(true);
    },
    close: () => {
      setIsOpen(false);
    },
    create,
  };
}
