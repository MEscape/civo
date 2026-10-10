import { useCallback, useEffect, useState } from 'react';

import { getOperationsCalendarAction } from '../actions/get-operations-calendar-action';

import type { CalendarRange } from '../calendar/calendar-model';
import type { OperationsCalendarDto } from '../dto/calendar-dto';

/** The filter value for "no filter"; a real id is never this word. */
export const ALL_FILTER = 'all';

export interface CalendarFilters {
  readonly locationId: string;
  readonly serviceId: string;
  readonly resourceId: string;
}

export type CalendarOutcome =
  | { readonly kind: 'ready'; readonly calendar: OperationsCalendarDto }
  | { readonly kind: 'failed'; readonly code: string };

interface Loaded {
  readonly key: string;
  readonly outcome: CalendarOutcome;
}

function readyCalendar(outcome: CalendarOutcome | null): OperationsCalendarDto | null {
  return outcome?.kind === 'ready' ? outcome.calendar : null;
}

/** Only the filters that narrow the result are sent. */
function activeFilters(filters: CalendarFilters): Partial<CalendarFilters> {
  return {
    ...(filters.locationId === ALL_FILTER ? {} : { locationId: filters.locationId }),
    ...(filters.serviceId === ALL_FILTER ? {} : { serviceId: filters.serviceId }),
    ...(filters.resourceId === ALL_FILTER ? {} : { resourceId: filters.resourceId }),
  };
}

export interface OperationsCalendarData {
  readonly range: CalendarRange | null;
  /** The current request's result; `null` while it loads. */
  readonly outcome: CalendarOutcome | null;
  /** The last good result, kept while the next one loads so the calendar does not flash empty. */
  readonly shown: OperationsCalendarDto | null;
  readonly changeRange: (next: CalendarRange) => void;
  readonly refresh: () => void;
}

/** Loads the bookings of the visible range for the chosen filters, again after every change or refresh. */
export function useOperationsCalendar(
  websiteId: string,
  filters: CalendarFilters,
): OperationsCalendarData {
  const [range, setRange] = useState<CalendarRange | null>(null);
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const { locationId, serviceId, resourceId } = filters;

  const requestKey =
    range === null
      ? null
      : `${range.from}|${range.to}|${locationId}|${serviceId}|${resourceId}|${version}`;

  useEffect(() => {
    if (range === null || requestKey === null) {
      return undefined;
    }
    let cancelled = false;
    void getOperationsCalendarAction({
      websiteId,
      from: range.from,
      to: range.to,
      ...activeFilters({ locationId, serviceId, resourceId }),
    }).then((result) => {
      if (cancelled) {
        return;
      }
      setLoaded({
        key: requestKey,
        outcome: result.ok
          ? { kind: 'ready', calendar: result.data }
          : { kind: 'failed', code: result.error.code },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [websiteId, range, requestKey, locationId, serviceId, resourceId]);

  const outcome = loaded?.key === requestKey ? loaded.outcome : null;

  return {
    range,
    outcome,
    shown: readyCalendar(outcome) ?? readyCalendar(loaded?.outcome ?? null),
    changeRange: useCallback((next: CalendarRange) => {
      setRange((current) =>
        current?.from === next.from && current.to === next.to ? current : next,
      );
    }, []),
    refresh: useCallback(() => {
      setVersion((current) => current + 1);
    }, []),
  };
}
