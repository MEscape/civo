import { randomBytes } from 'node:crypto';

import {
  BOOKING_REFERENCE_ALPHABET,
  BOOKING_REFERENCE_LENGTH,
  toBookingReference,
} from '../../domain/models/booking-reference';

import type { BookingReference } from '../../domain/models/booking-reference';
import type { BookingReferenceGenerator } from '../../domain/ports/booking-reference-generator.port';

/**
 * References come from the operating system's secure random source. The
 * alphabet has exactly 32 symbols, so taking five bits per byte is uniform
 * (no modulo bias), and ten symbols give 50 bits: a stranger cannot guess a
 * reference, and a collision between two bookings is vanishingly unlikely
 * (and would surface as a storage conflict, never as a wrong booking).
 */
export class RandomBookingReferenceGenerator implements BookingReferenceGenerator {
  next(): BookingReference {
    const bytes = randomBytes(BOOKING_REFERENCE_LENGTH);
    let reference = '';
    for (const byte of bytes) {
      reference += BOOKING_REFERENCE_ALPHABET.charAt(byte & 31);
    }
    return toBookingReference(reference);
  }
}
