import type { BookingReference } from '../models/booking-reference';

/**
 * Produces booking references. A port because the domain and application
 * layers may not read randomness; the real one draws from a secure source
 * and a test one counts.
 */
export interface BookingReferenceGenerator {
  next(): BookingReference;
}
