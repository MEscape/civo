import { buildQueryString } from '@lib/utils';

import { dayOf } from './month-calendar';

import type { BookingFilterParams, CalendarView } from '../schemas/parse-booking-list-input';

/** What the address of the bookings list carries now. The days are the ones the list was read for. */
export interface BookingListView extends BookingFilterParams {
  readonly page: number;
  readonly pageSize: number;
  readonly bookingId: string | undefined;
}

/** What a link changes; `null` takes a parameter away. */
export interface BookingListChange {
  readonly page?: number;
  readonly state?: BookingFilterParams['state'] | null;
  readonly bookingId?: string | null;
}

const changed = <T>(value: T | null | undefined, current: T | undefined) =>
  value === null ? undefined : (value ?? current);

/** The address of the list with one thing changed and everything else kept, so a link never loses the filters. */
export function bookingListHref(
  base: string,
  view: BookingListView,
  change: BookingListChange = {},
): string {
  return `${base}${buildQueryString({
    from: view.from,
    to: view.to,
    state: changed(change.state, view.state),
    location: view.locationId,
    service: view.serviceId,
    resource: view.resourceId,
    q: view.reference,
    booking: changed(change.bookingId, view.bookingId),
    // A new filter starts again at the first page.
    page: change.state === undefined ? (change.page ?? view.page) : undefined,
    pageSize: view.pageSize,
  })}`;
}

/** What the address of the calendar carries. */
export interface CalendarAddress {
  readonly view: CalendarView;
  readonly date: string;
  readonly locationId: string | undefined;
  readonly state: BookingFilterParams['state'];
}

export function calendarHref(base: string, address: CalendarAddress): string {
  return `${base}${buildQueryString({
    view: address.view,
    date: address.date,
    location: address.locationId,
    state: address.state,
  })}`;
}

/** The list on a booking's own day with its details open: where a calendar entry or a new booking leads. */
export function bookingDetailsHref(
  base: string,
  booking: { readonly id: string; readonly start: string },
): string {
  const day = dayOf(booking.start);
  return `${base}${buildQueryString({ from: day, to: day, booking: booking.id })}`;
}
