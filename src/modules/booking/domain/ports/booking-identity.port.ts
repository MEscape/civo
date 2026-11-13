import type { BookingReference } from '../models/booking-reference';
import type { BookingId } from '../models/ids';

/**
 * Produces the identities of new bookings. A port because the domain and application layers may not
 * read randomness; the real one draws from a secure source and a test one counts.
 */
export interface BookingIdentityGenerator {
  /** A fresh id. */
  nextId(): BookingId;

  /**
   * An id that depends only on `parts`: the same parts always give the same id, other parts a
   * different one, and nobody can work out another caller's id from them. A retry of a request that
   * names its attempt (`parts` hold the tenant, the actor and the caller's key) therefore meets the
   * booking its first try made, and cannot meet anyone else's.
   */
  idFor(parts: readonly string[]): BookingId;

  /** A fresh reference the visitor quotes. */
  nextReference(): BookingReference;
}
