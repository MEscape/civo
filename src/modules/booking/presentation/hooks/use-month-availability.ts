import { useEffect, useMemo, useRef, useState } from 'react';

import { getAvailableSlotsAction } from '../actions/get-available-slots-action';
import {
  compareYearMonth,
  currentYearMonth,
  firstDayOf,
  lastDayOf,
  shiftMonth,
  yearMonthAfterDays,
} from '../time/month-math';

import type { AvailabilityDto } from '../dto/availability-dto';
import type { YearMonth } from '../time/month-math';

export type AvailabilityOutcome =
  | { readonly kind: 'ready'; readonly availability: AvailabilityDto }
  | { readonly kind: 'failed'; readonly code: string };

interface Loaded {
  readonly key: string;
  readonly outcome: AvailabilityOutcome;
}

/** When the first month has nothing, look ahead this many months before showing an empty one. */
const MAX_AUTO_ADVANCE = 3;

export interface MonthAvailabilityQuery {
  readonly websiteId: string;
  readonly serviceId: string;
  readonly locationId: string;
  readonly participants: number;
  /** The furthest ahead a visitor can book, in days; the month never pages past it. */
  readonly horizonDays: number;
  /** A slot is already chosen, so the month it lives in must not jump ahead on its own. */
  readonly hasSelection: boolean;
}

export interface MonthAvailability {
  readonly month: YearMonth;
  readonly from: string;
  /** `null` while the month is loading. */
  readonly outcome: AvailabilityOutcome | null;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly goToMonth: (delta: number) => void;
  readonly retry: () => void;
}

/**
 * Loads live availability for one month at a time. The server is asked again
 * for every month and every retry; nothing is cached or assumed free. When
 * the opening month has no times, it pages ahead on its own, a few months at
 * most, so a visitor does not land on an empty calendar.
 */
export function useMonthAvailability(query: MonthAvailabilityQuery): MonthAvailability {
  const { websiteId, serviceId, locationId, participants, horizonDays, hasSelection } = query;
  const [month, setMonth] = useState<YearMonth>(() => currentYearMonth());
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const autoAdvanceLeft = useRef(hasSelection ? 0 : MAX_AUTO_ADVANCE);

  const from = firstDayOf(month);
  const to = lastDayOf(month);
  const requestKey = `${serviceId}|${locationId}|${participants}|${from}|${attempt}`;
  const lastMonth = useMemo(() => yearMonthAfterDays(horizonDays), [horizonDays]);
  const firstMonth = useMemo(() => currentYearMonth(), []);

  useEffect(() => {
    let cancelled = false;
    void getAvailableSlotsAction({ websiteId, serviceId, locationId, from, to, participants }).then(
      (result) => {
        if (cancelled) {
          return;
        }
        if (!result.ok) {
          setLoaded({ key: requestKey, outcome: { kind: 'failed', code: result.error.code } });
          return;
        }
        const nextMonth = shiftMonth(month, 1);
        const shouldAdvance =
          result.data.slots.length === 0 &&
          autoAdvanceLeft.current > 0 &&
          compareYearMonth(nextMonth, lastMonth) <= 0;
        if (shouldAdvance) {
          autoAdvanceLeft.current -= 1;
          setMonth(nextMonth);
          return;
        }
        autoAdvanceLeft.current = 0;
        setLoaded({ key: requestKey, outcome: { kind: 'ready', availability: result.data } });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [websiteId, serviceId, locationId, participants, from, to, requestKey, month, lastMonth]);

  return {
    month,
    from,
    outcome: loaded?.key === requestKey ? loaded.outcome : null,
    canGoBack: compareYearMonth(shiftMonth(month, -1), firstMonth) >= 0,
    canGoForward: compareYearMonth(shiftMonth(month, 1), lastMonth) <= 0,
    goToMonth: (delta) => {
      autoAdvanceLeft.current = 0;
      setMonth(shiftMonth(month, delta));
    },
    retry: () => {
      setAttempt((count) => count + 1);
    },
  };
}
