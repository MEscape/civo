'use client';

import { useState } from 'react';

import type { AdoptMode } from '../../application/contracts/booking-constraints';

/** Which services of other locations a new location takes over, and how. */
export interface Offer {
  readonly mode: AdoptMode;
  readonly count: number;
  readonly chosenIds: ReadonlySet<string>;
  readonly isChosen: (serviceId: string) => boolean;
  readonly setMany: (serviceIds: readonly string[], isChosen: boolean) => void;
  readonly setMode: (mode: AdoptMode) => void;
}

/** The choice made in the new-location wizard's services step: kept across its steps, gone with the form. */
export function useLocationOffer(): Offer {
  const [chosenIds, setChosenIds] = useState<ReadonlySet<string>>(new Set());
  const [mode, setMode] = useState<AdoptMode>('copy');

  return {
    mode,
    count: chosenIds.size,
    chosenIds,
    isChosen: (serviceId) => chosenIds.has(serviceId),
    setMany: (serviceIds, isChosen) => {
      const next = new Set(chosenIds);
      for (const serviceId of serviceIds) {
        if (isChosen) {
          next.add(serviceId);
        } else {
          next.delete(serviceId);
        }
      }
      setChosenIds(next);
    },
    setMode,
  };
}
