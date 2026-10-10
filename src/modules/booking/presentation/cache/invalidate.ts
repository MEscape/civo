import { revalidatePath } from 'next/cache';

import { bookingRoutes } from '../routes';

/**
 * The ONE place cache invalidation is expressed (caching.md). Booking data
 * is never cached for visitors: availability is computed from live data on
 * every request, because a cached slot list is exactly how two visitors end
 * up looking at a time that is already gone. Only the admin screens are
 * rendered from cached route output, so those are what a mutation refreshes.
 */
export function invalidateBookingAdmin(websiteId: string): void {
  revalidatePath(bookingRoutes.admin(websiteId));
}
