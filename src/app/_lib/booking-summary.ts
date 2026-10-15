import { cache } from 'react';

import { bookingQueries } from '@modules/booking';

/** One booking summary per request, shared by the overview's appointments and its first steps. */
export const loadBookingSummary = cache((websiteId: string) =>
  bookingQueries.getBookingSummary.execute(websiteId),
);
