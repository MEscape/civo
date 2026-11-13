'use client';

import { useSyncExternalStore } from 'react';

import { BOOKING_INPUT_LIMITS } from '../../application/contracts/booking-constraints';
import { BOOKING_MANAGE_PARAM } from '../routes';

const noSubscription = () => () => undefined;

function readReference(): string | undefined {
  const reference = new URLSearchParams(window.location.search).get(BOOKING_MANAGE_PARAM)?.trim();
  return reference === undefined ||
    reference === '' ||
    reference.length > BOOKING_INPUT_LIMITS.referenceMax
    ? undefined
    : reference;
}

/**
 * The booking number of the link in a booking message (`?manage=`), read from the address in the
 * browser; `undefined` on the server and on a page reached without one. Only a number is read,
 * never an address: the visitor types that themselves.
 */
export function useLinkedReference(): string | undefined {
  return useSyncExternalStore(noSubscription, readReference, () => undefined);
}
