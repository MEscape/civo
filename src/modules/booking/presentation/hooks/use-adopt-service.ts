'use client';

import { useState, useTransition } from 'react';

import { useRouter } from '@i18n';

import { adoptServiceAction } from '../actions/adopt-service-action';
import { bookingRoutes } from '../routes';

import type { AdoptMode } from '../../application/contracts/booking-constraints';

export interface AdoptTarget {
  readonly websiteId: string;
  readonly locationId: string;
  readonly serviceId: string;
  /** The location the service was picked from: where a copy says it came from. */
  readonly sourceLocationId: string;
}

/**
 * Taking a service over: the chosen mode, the refusal if the server gave one, and the submit. Success
 * is shown only after the server has confirmed it, by arriving at the service that now exists.
 */
export function useAdoptService({
  websiteId,
  locationId,
  serviceId,
  sourceLocationId,
}: AdoptTarget) {
  const router = useRouter();
  const [mode, setMode] = useState<AdoptMode>('copy');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function adopt() {
    setErrorCode(null);
    startTransition(async () => {
      const result = await adoptServiceAction({
        websiteId,
        locationId,
        serviceId,
        sourceLocationId,
        mode,
      });
      if (result.ok) {
        router.push(`${bookingRoutes.service(websiteId, locationId, result.data.id)}?saved=1`);
        return;
      }
      setErrorCode(result.error.code);
    });
  }

  return { mode, setMode, errorCode, isPending, adopt };
}
