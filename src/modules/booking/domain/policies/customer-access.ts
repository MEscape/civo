import { trimToNull } from '@lib/utils';

import type { Booking } from '../models/booking';

/** The e-mail address as it is compared and searched: trimmed and lower-case, `null` when nothing is left. */
export function normalizeEmail(email: string | null | undefined): string | null {
  return trimToNull(email)?.toLowerCase() ?? null;
}

/**
 * Whether the address a visitor typed is the one the booking was made with. A booking is reached by
 * its reference AND this address: the reference alone is not a secret (it is on the confirmation and
 * quoted over the phone), so possession of both is what stands for "my booking". A booking without
 * an address (a hold) belongs to nobody who can ask for it.
 */
export function isCustomerOf(booking: Booking, email: string): boolean {
  const known = normalizeEmail(booking.customer?.email);
  return known !== null && known === normalizeEmail(email);
}
