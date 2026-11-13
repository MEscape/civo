import { cache } from 'react';

import type { BookingReaders } from './booking-readers';

/**
 * The open bookings on offer to the signed-in employee, unfiltered, read once per request: the bar's
 * count, the start page and the unfiltered list share it (the queries are one object per process).
 */
export const loadOpenBookings = cache(async (queries: BookingReaders, websiteId: string) =>
  queries.getOpenBookings.execute({ websiteId }),
);
