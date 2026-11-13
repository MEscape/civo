import { connection } from 'next/server';

import { orNotFound } from '@lib/errors/or-not-found';

import { calendarDays } from '../forms/calendar-range';
import { parseBookingListParams, parseCalendarParams } from '../schemas/parse-booking-list-input';

import type { BookingReaders, RawSearchParams } from './booking-readers';

interface Input {
  readonly websiteId: string;
  readonly searchParams: RawSearchParams;
  readonly queries: BookingReaders;
}

/**
 * Reads what the manager's list shows: the names that label it, the page of bookings the address
 * asks for (days that are no span fall back to today) and the booking chosen for the side panel.
 * The database driver draws random ids, which a prerender may not do: these reads belong to the
 * request.
 */
export async function loadBookingsAdministration({ websiteId, searchParams, queries }: Input) {
  await connection();
  const filters = parseBookingListParams(searchParams);
  const names = await orNotFound(queries.getBookingNames.execute({ websiteId }));
  const listed = await queries.listBookings.execute({ ...filters, websiteId });
  const page = listed.isOk()
    ? listed.value
    : await orNotFound(
        queries.listBookings.execute({ ...filters, websiteId, from: undefined, to: undefined }),
      );
  const selected =
    filters.bookingId === undefined
      ? null
      : await queries.getBooking.execute({ websiteId, bookingId: filters.bookingId });
  return { filters, names, page, selected };
}

/** Reads what the calendar shows: the names, and every booking of the period the address asks for. */
export async function loadCalendarAdministration({ websiteId, searchParams, queries }: Input) {
  await connection();
  const filters = parseCalendarParams(searchParams);
  const names = await orNotFound(queries.getBookingNames.execute({ websiteId }));
  const home =
    names.locations.find((location) => location.id === filters.locationId) ?? names.locations[0];
  const date = filters.date ?? home?.today;
  const calendar =
    date === undefined
      ? null
      : await orNotFound(
          queries.getBookingCalendar.execute({
            ...calendarDays(filters.view, date),
            websiteId,
            state: filters.state,
            locationId: filters.locationId,
          }),
        );
  return { filters, names, home, date, calendar };
}
