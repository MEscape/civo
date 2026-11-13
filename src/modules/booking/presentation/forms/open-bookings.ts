import { offsetOf, resolvePageRequest, toPage } from '@lib/pagination';
import type { Page } from '@lib/pagination';
import { buildQueryString, keyBy } from '@lib/utils';

import type { OpenBookingDto } from '../dto/booking-dto';

/** The tabs of the open bookings: every fit, the two best on their own, the rest together. */
export const FIT_LEVEL_TABS = ['all', 'very-good', 'good', 'other'] as const;
export type FitTab = (typeof FIT_LEVEL_TABS)[number];

export function fitTabOf(level: OpenBookingDto['fit']['level']): Exclude<FitTab, 'all'> {
  return level === 'very-good' || level === 'good' ? level : 'other';
}

/** How many bookings each tab holds; `all` is the length of the list. */
export function countByTab(items: readonly OpenBookingDto[]): Record<FitTab, number> {
  const counts: Record<FitTab, number> = { all: items.length, 'very-good': 0, good: 0, other: 0 };
  for (const item of items) {
    counts[fitTabOf(item.fit.level)] += 1;
  }
  return counts;
}

/** How many open bookings suit the employee well: the very good and the good fits, as the start page says. */
export function matchingCount(items: readonly OpenBookingDto[]): number {
  const counts = countByTab(items);
  return counts['very-good'] + counts.good;
}

/** Those of the tab whose service or location contains the search text (any case). */
export function visibleOpen(
  items: readonly OpenBookingDto[],
  view: { readonly fit: FitTab; readonly q: string | undefined },
): OpenBookingDto[] {
  const needle = view.q?.toLocaleLowerCase();
  return items.filter((item) => {
    const inTab = view.fit === 'all' || fitTabOf(item.fit.level) === view.fit;
    const text = `${item.labels.serviceName ?? ''} ${item.labels.locationName ?? ''}`;
    return inTab && (needle === undefined || text.toLocaleLowerCase().includes(needle));
  });
}

/** The locations the open bookings are at, each once: what the location filter offers. */
export function locationsOf(
  items: readonly OpenBookingDto[],
): ReadonlyArray<{ readonly id: string; readonly name: string }> {
  const named = items.map((item) => ({
    id: item.booking.locationId,
    name: item.labels.locationName ?? item.booking.locationId,
  }));
  return [...keyBy(named, (location) => location.id).values()];
}

/** What the address of the open bookings carries. */
export interface OpenListView {
  readonly date?: string | undefined;
  readonly location?: string | undefined;
  readonly part?: string | undefined;
  readonly fit?: FitTab | undefined;
  readonly q?: string | undefined;
}

/** The address of the list with another tab or page and every filter kept. */
export function openListHref(
  base: string,
  view: OpenListView,
  change: { readonly fit?: FitTab; readonly page?: number } = {},
): string {
  const fit = change.fit ?? view.fit;
  return `${base}${buildQueryString({
    date: view.date,
    location: view.location,
    part: view.part,
    fit: fit === 'all' ? undefined : fit,
    q: view.q,
    page: change.page,
  })}`;
}

/** Rows on one page of the open bookings. */
const OPEN_PAGE_LIMITS = { defaultPageSize: 10, maxPageSize: 10 } as const;

/**
 * What the list shows for an address: the tab, how many each tab holds (the search applied, the tab
 * not), and the page of the tab's bookings.
 */
export function openListSlice(
  items: readonly OpenBookingDto[],
  view: OpenListView,
  page: unknown,
): {
  readonly fit: FitTab;
  readonly counts: Record<FitTab, number>;
  readonly slice: Page<OpenBookingDto>;
} {
  const fit = view.fit ?? 'all';
  const shown = visibleOpen(items, { fit, q: view.q });
  const request = resolvePageRequest({ page }, OPEN_PAGE_LIMITS);
  const start = offsetOf(request);
  return {
    fit,
    counts: countByTab(visibleOpen(items, { fit: 'all', q: view.q })),
    slice: toPage(shown.slice(start, start + request.pageSize), shown.length, request),
  };
}
