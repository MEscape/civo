import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import type { BookingAccess } from '../../domain/ports/booking-access.port';

/**
 * Whether the signed-in person may see who booked in the named website: name, e-mail, phone and
 * notes. Only those who manage bookings (`booking.manage`) contact citizens; looking at the
 * bookings (`booking.read`, a viewer) shows when and what, never who. Asked through the access
 * port, so the rule lives in the role table and nowhere else.
 */
export function mayContactCustomers(
  access: BookingAccess,
  websiteId: string,
): AppResultAsync<boolean, never> {
  return access
    .authorizeWebsite('booking.manage', websiteId)
    .map(() => true)
    .orElse(() => okAsync(false));
}
