import { describe, expect, it } from 'vitest';

import {
  bookingDataInvalid,
  BOOKING_ERROR_CODES,
} from '@modules/booking/domain/errors/booking-errors';
import { RESOURCE_TYPES, servesLocation } from '@modules/booking/domain/models/bookable-resource';
import {
  BOOKING_STATUSES,
  hasOpenUnits,
  heldResourceIds,
  isBlocking,
  isLiveStatus,
} from '@modules/booking/domain/models/booking';
import {
  SHARED_SESSION_PREFIX,
  isSharedSession,
} from '@modules/booking/domain/models/booking-session';
import {
  BOOKING_ID_MAX_LENGTH,
  parseBookableResourceId,
  parseBookableServiceId,
  parseBookingId,
  parseBookingLocationId,
  parseWebsiteId,
} from '@modules/booking/domain/models/ids';
import { asInstant } from '@modules/booking/domain/time/instant';
import { findOverlap } from '@modules/booking/domain/time/time-interval';

import {
  LOCATION,
  MONDAY,
  NOW,
  OTHER_LOCATION,
  employee,
  makeBooking,
  unitOf,
} from '../support/booking-fixtures';
import { between } from '../support/time-fixtures';

describe('ids from outside', () => {
  const parsers = [
    ['serviceId', parseBookableServiceId],
    ['locationId', parseBookingLocationId],
    ['resourceId', parseBookableResourceId],
    ['bookingId', parseBookingId],
    ['websiteId', parseWebsiteId],
  ] as const;

  it('accepts a non-empty id up to the bound, and says which field is wrong otherwise', () => {
    for (const [field, parse] of parsers) {
      expect(parse('abc').isOk()).toBe(true);
      expect(parse('x'.repeat(BOOKING_ID_MAX_LENGTH)).isOk()).toBe(true);

      const empty = parse('');
      expect(empty.isErr() && empty.error.fieldErrors).toEqual({
        [field]: ['booking.validation.id_invalid'],
      });
      expect(parse('x'.repeat(BOOKING_ID_MAX_LENGTH + 1)).isErr()).toBe(true);
    }
  });
});

describe('resources and bookings', () => {
  it('knows the same resource types as the database', () => {
    // `__tests__/src/lib/db/contract-enums.test.ts` compares this list with the enum of the schema.
    expect(RESOURCE_TYPES).toContain('employee');
    expect(new Set(RESOURCE_TYPES).size).toBe(RESOURCE_TYPES.length);
  });

  it('serves a location when it has none of its own, or when it is its own', () => {
    expect(servesLocation(employee('anna'), LOCATION)).toBe(true);
    expect(servesLocation(employee('anna'), OTHER_LOCATION)).toBe(false);
    expect(servesLocation(employee('van', { locationId: null }), OTHER_LOCATION)).toBe(true);
  });

  it('holds what is assigned, and waits for what is not', () => {
    const booking = makeBooking({
      assignments: [unitOf('anna'), unitOf(null, { requirementIndex: 1 })],
    });
    expect(heldResourceIds(booking)).toEqual(['anna']);
    expect(hasOpenUnits(booking)).toBe(true);
    expect(hasOpenUnits(makeBooking())).toBe(false);
  });
});

describe('finding an overlap', () => {
  const list = [between(MONDAY, '09:00', '10:00'), between(MONDAY, '12:00', '13:00')];

  it('returns the member that shares time with the target, and null for touching or none', () => {
    expect(findOverlap(list, between(MONDAY, '09:30', '09:45'))).toEqual(list[0]);
    expect(findOverlap(list, between(MONDAY, '11:00', '12:01'))).toEqual(list[1]);
    expect(findOverlap(list, between(MONDAY, '10:00', '12:00'))).toBeNull();
    expect(findOverlap([], between(MONDAY, '10:00', '12:00'))).toBeNull();
  });
});

describe('which bookings can occupy a resource', () => {
  it('names exactly the statuses that isBlocking can say yes to', () => {
    const live = BOOKING_STATUSES.filter((status) => isLiveStatus(status));

    expect(live).toEqual(['held', 'confirmed']);
    for (const status of BOOKING_STATUSES) {
      const booking = makeBooking({
        status,
        holdExpiresAt: status === 'held' ? asInstant(NOW + 1) : null,
      });
      expect(isBlocking(booking, NOW)).toBe(isLiveStatus(status));
    }
  });

  it('tells a shared session by the prefix of its key, and nothing else', () => {
    expect(isSharedSession(`${SHARED_SESSION_PREFIX}class`)).toBe(true);
    expect(isSharedSession('booking:b1')).toBe(false);
    expect(isSharedSession('')).toBe(false);
  });

  it('reports data in a shape the rules do not expect as a persistence failure that names only the part', () => {
    const error = bookingDataInvalid('customer');

    expect(error).toMatchObject({
      kind: 'infrastructure',
      code: BOOKING_ERROR_CODES.persistenceFailed,
    });
    expect(error.message).not.toContain('customer');
  });
});
