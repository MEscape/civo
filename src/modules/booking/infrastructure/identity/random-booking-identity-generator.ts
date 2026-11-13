import { createHash, randomBytes, randomUUID } from 'node:crypto';

import {
  BOOKING_REFERENCE_ALPHABET,
  BOOKING_REFERENCE_LENGTH,
  toBookingReference,
} from '../../domain/models/booking-reference';
import { toBookingId } from '../../domain/models/ids';

import type { BookingReference } from '../../domain/models/booking-reference';
import type { BookingId } from '../../domain/models/ids';
import type { BookingIdentityGenerator } from '../../domain/ports/booking-identity.port';

/** Five bits per byte: the alphabet has 32 symbols, so this mask keeps the draw uniform. */
const ALPHABET_MASK = BOOKING_REFERENCE_ALPHABET.length - 1;

const DERIVED_ID_HEX_LENGTH = 32;

/**
 * Identities from the operating system's secure random source. A reference takes five bits per byte
 * of an alphabet of exactly 32 symbols (no modulo bias): ten symbols give 50 bits, so a stranger
 * cannot guess one, and a collision between two bookings is vanishingly unlikely (and would surface
 * as a storage conflict, never as a wrong booking).
 *
 * A derived id is the SHA-256 of its parts, joined unambiguously (as JSON), so different parts never
 * give the same text, and the same parts always give the same id.
 */
export class RandomBookingIdentityGenerator implements BookingIdentityGenerator {
  nextId(): BookingId {
    return toBookingId(randomUUID());
  }

  idFor(parts: readonly string[]): BookingId {
    const digest = createHash('sha256').update(JSON.stringify(parts)).digest('hex');
    return toBookingId(`bk-${digest.slice(0, DERIVED_ID_HEX_LENGTH)}`);
  }

  nextReference(): BookingReference {
    let reference = '';
    for (const byte of randomBytes(BOOKING_REFERENCE_LENGTH)) {
      reference += BOOKING_REFERENCE_ALPHABET.charAt(byte & ALPHABET_MASK);
    }
    return toBookingReference(reference);
  }
}

/** The one instance the composition root wires (the adapter holds no state). */
export const randomBookingIdentityGenerator = new RandomBookingIdentityGenerator();
