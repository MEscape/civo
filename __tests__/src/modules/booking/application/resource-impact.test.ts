import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toTenantId } from '@modules/auth';
import {
  findResourceImpact,
  impactOfChange,
} from '@modules/booking/application/services/resource-impact';
import {
  toBookableResourceId,
  toBookingId,
  toBookingLocationId,
  toWebsiteId,
} from '@modules/booking/domain/models/ids';
import type { BookingScope } from '@modules/booking/domain/ports/booking.repository';
import type { StoredLocation } from '@modules/booking/domain/ports/location-admin.repository';
import type { StoredResource } from '@modules/booking/domain/ports/resource-admin.repository';
import { parseMinutes } from '@modules/booking/domain/time/minutes';

import { okAsync } from '@lib/result';

import { makeBooking, unitOf } from '../support/booking-fixtures';
import { BERLIN, at } from '../support/time-fixtures';

describe('resource-impact application service', () => {
  const scope: BookingScope = {
    tenantId: toTenantId('tenant-1'),
    websiteId: toWebsiteId('web-1'),
  };

  const now = at('2027-01-10', '12:00');
  const locationId = toBookingLocationId('loc-1');
  const resourceId = toBookableResourceId('res-room-1');

  const location: StoredLocation = {
    id: locationId,
    name: 'Bürgeramt West',
    address: 'Hauptstr. 1',
    zone: BERLIN,
    isActive: true,
    openingHours: {
      weekly: Object.fromEntries(
        [1, 2, 3, 4, 5, 6, 7].map((day) => [
          day,
          {
            ranges: day <= 5 ? [{ startMinute: 8 * 60, endMinute: 17 * 60 }] : [],
            breaks: [],
          },
        ]),
      ) as any,
      exceptions: [],
    },
    updatedAt: at('2027-01-01', '08:00'),
  };

  const storedResource: StoredResource = {
    id: resourceId,
    name: 'Room 101',
    type: 'room',
    capacity: 2,
    locationId,
    isActive: true,
    setupMinutes: parseMinutes(0)!,
    teardownMinutes: parseMinutes(0)!,
    availability: null,
    internalNote: null,
    updatedAt: at('2027-01-01', '08:00'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('impactOfChange', () => {
    it('returns location not found error when location repository returns null', async () => {
      const deps = {
        bookings: { list: vi.fn() },
        locations: { findById: vi.fn().mockReturnValue(okAsync(null)) },
      };

      const result = await impactOfChange(deps, {
        scope,
        resource: storedResource,
        next: { availability: null, capacity: 1 },
        now,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('booking.location_not_found');
    });

    it('finds impact when location exists', async () => {
      const deps = {
        bookings: { list: vi.fn().mockReturnValue(okAsync([])) },
        locations: { findById: vi.fn().mockReturnValue(okAsync(location)) },
      };

      const result = await impactOfChange(deps, {
        scope,
        resource: storedResource,
        next: { availability: null, capacity: 1 },
        now,
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({
        affected: [],
        isTruncated: false,
      });
    });
  });

  describe('findResourceImpact', () => {
    it('returns empty affected list when no bookings exist in horizon', async () => {
      const deps = {
        bookings: { list: vi.fn().mockReturnValue(okAsync([])) },
      };

      const result = await findResourceImpact(deps, {
        scope,
        location,
        resource: storedResource,
        next: { availability: null, capacity: 0 },
        now,
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().affected).toEqual([]);
    });

    it('identifies affected bookings when capacity is reduced below held places', async () => {
      const booking = makeBooking({
        id: toBookingId('b-1'),
        start: at('2027-01-11', '10:00'),
        end: at('2027-01-11', '10:30'),
        assignments: [unitOf('res-room-1')],
      });

      const deps = {
        bookings: {
          list: vi.fn().mockReturnValue(okAsync([{ booking, reference: 'REF1' }])),
        },
      };

      // Reducing capacity from 2 to 0
      const result = await findResourceImpact(deps, {
        scope,
        location,
        resource: storedResource,
        next: { availability: null, capacity: 0 },
        now,
      });

      expect(result.isOk()).toBe(true);
      const impact = result._unsafeUnwrap();
      expect(impact.affected).toHaveLength(1);
      expect(impact.affected[0]?.bookingId).toBe('b-1');
      expect(impact.affected[0]?.reason).toBe('over-capacity');
      expect(impact.isTruncated).toBe(false);
    });

    it('does not report bookings that were already affected before the change', async () => {
      const booking = makeBooking({
        id: toBookingId('b-1'),
        start: at('2027-01-11', '10:00'),
        end: at('2027-01-11', '10:30'),
        assignments: [unitOf('res-room-1')],
      });

      const deps = {
        bookings: {
          list: vi.fn().mockReturnValue(okAsync([{ booking, reference: 'REF1' }])),
        },
      };

      // Both before and next have 0 capacity (already affected)
      const resourceWithZero = { ...storedResource, capacity: 0 };
      const result = await findResourceImpact(deps, {
        scope,
        location,
        resource: resourceWithZero,
        next: { availability: null, capacity: 0 },
        now,
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().affected).toEqual([]);
    });
  });
});
