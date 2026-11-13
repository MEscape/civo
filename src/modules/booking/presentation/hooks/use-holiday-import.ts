'use client';

import { useState } from 'react';

import { withHolidays } from '../forms/exceptions';

import type { GermanRegion } from '../../application/contracts/booking-constraints';
import type { ExceptionInputDto } from '../dto/location-dto';

/**
 * The dialog of a holiday import: whether it is open, the state and year picked, and applying it.
 * `added` is how many closures the last import added (`null` before any), so the list can say so,
 * including that there was nothing new.
 */
export function useHolidayImport(
  value: readonly ExceptionInputDto[],
  onChange: (exceptions: ExceptionInputDto[]) => void,
  years: readonly number[],
) {
  const [isOpen, setIsOpen] = useState(false);
  const [region, setRegion] = useState<GermanRegion>('DE');
  const [year, setYear] = useState<number | undefined>(years[0]);
  const [added, setAdded] = useState<number | null>(null);

  return {
    isOpen,
    region,
    setRegion,
    year,
    setYear,
    added,
    open: () => {
      setIsOpen(true);
    },
    close: () => {
      setIsOpen(false);
    },
    apply: () => {
      if (year === undefined) {
        return;
      }
      const imported = withHolidays(value, region, year);
      onChange(imported.next);
      setAdded(imported.added);
      setIsOpen(false);
    },
    /** A later change to the list makes the last answer stale. */
    forget: () => {
      setAdded(null);
    },
  };
}
