import { connection } from 'next/server';

import { orNotFound } from '@lib/errors/or-not-found';
import { orNull } from '@lib/errors/or-null';

import { dayAfter } from '../forms/month-calendar';
import { WEEK_DAYS } from '../forms/overview-week';

import type { BookingReaders } from './booking-readers';

/** The bookings of today the overview names; the list behind "all bookings" has the rest. */
const TODAY_ROWS = 6;
const LAST_DAY_OF_WEEK = WEEK_DAYS - 1;

interface Input {
  readonly websiteId: string;
  readonly queries: BookingReaders;
}

/**
 * Reads what the workspace's first screen shows: how far the setup has come, the names that label
 * the rows, today's bookings and the week ahead (on the first location's calendar) and the locations
 * with their hours today. Today is runtime data, so these reads belong to the request.
 */
export async function loadBookingOverview({ websiteId, queries }: Input) {
  await connection();
  const [setup, names, locations] = await Promise.all([
    orNotFound(queries.getBookingSetup.execute({ websiteId })),
    orNotFound(queries.getBookingNames.execute({ websiteId })),
    orNull(queries.listLocations.execute({ websiteId, page: {} })),
  ]);
  const day = names.locations[0]?.today;
  const [today, week] =
    day === undefined
      ? [null, null]
      : await Promise.all([
          orNull(
            queries.listBookings.execute({
              websiteId,
              from: day,
              to: day,
              page: { pageSize: TODAY_ROWS },
            }),
          ),
          orNull(
            queries.getBookingCalendar.execute({
              websiteId,
              from: day,
              to: dayAfter(day, LAST_DAY_OF_WEEK),
            }),
          ),
        ]);
  return { setup, names, today, week, day, locations };
}
