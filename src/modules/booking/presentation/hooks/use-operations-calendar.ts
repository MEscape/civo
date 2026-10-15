import { useCallback, useEffect, useRef, useState } from 'react';

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

/** Ranges kept for going back to one: a few weeks and months, no more. */
const KEPT_RANGES = 12;

/**
 * Loads the bookings of the visible range for the chosen filters, and nothing
 * beyond it: the view (month, week, day) decides what is fetched. A range
 * that was shown before appears at once while it is read again, so paging
 * back and forth does not flash empty; every change or refresh forgets them,
 * and they live only in this browser tab (the data is personal and
 * tenant-scoped, so it is never shared through a cache).
 */
export function useOperationsCalendar(
  websiteId: string,
  filters: CalendarFilters,
): OperationsCalendarData {
  const [range, setRange] = useState<CalendarRange | null>(null);
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const seen = useRef(new Map<string, CalendarOutcome>());
  const { locationId, serviceId, resourceId } = filters;

  const requestKey =
    range === null
      ? null
      : `${range.from}|${range.to}|${locationId}|${serviceId}|${resourceId}|${version}`;

  const rangeKey =
    range === null ? '' : `${range.from}|${range.to}|${locationId}|${serviceId}|${resourceId}`;

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
      const outcome: CalendarOutcome = result.ok
        ? { kind: 'ready', calendar: result.data }
        : { kind: 'failed', code: result.error.code };
      if (result.ok) {
        seen.current.delete(rangeKey);
        seen.current.set(rangeKey, outcome);
        if (seen.current.size > KEPT_RANGES) {
          seen.current.delete(seen.current.keys().next().value ?? rangeKey);
        }
      }
      setLoaded({ key: requestKey, outcome });
    });
    return () => {
      cancelled = true;
    };
  }, [websiteId, range, requestKey, rangeKey, locationId, serviceId, resourceId]);

  const outcome = loaded?.key === requestKey ? loaded.outcome : null;

  return {
    range,
    outcome,
    shown:
      readyCalendar(outcome) ??
      readyCalendar(seen.current.get(rangeKey) ?? null) ??
      readyCalendar(loaded?.outcome ?? null),
    changeRange: useCallback((next: CalendarRange) => {
      setRange((current) =>
        current?.from === next.from && current.to === next.to ? current : next,
      );
    }, []),
    refresh: useCallback(() => {
      seen.current.clear();
      setVersion((current) => current + 1);
    }, []),
  };
}
