import { describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth';
import {
  countsOf,
  daysView,
  resolveBookingFilter,
  viewsOf,
} from '@modules/booking/application/services/booking-filter';
import { toBookingId, toBookingLocationId, toWebsiteId } from '@modules/booking/domain/models/ids';
import type { BookingScope, StoredBooking } from '@modules/booking/domain/ports/booking.repository';
import type { StoredLocation } from '@modules/booking/domain/ports/location-admin.repository';
import { asInstant } from '@modules/booking/domain/time/instant';

import { okAsync } from '@lib/result';

import { NOW, STORED_WORKING_WEEK, makeBooking } from '../support/booking-fixtures';

describe('booking-filter application service', () => {
  const scope: BookingScope = {
    tenantId: toTenantId('tenant-1'),
    websiteId: toWebsiteId('website-1'),
  };

  const storedLocation: StoredLocation = {
    address: null,
    id: toBookingLocationId('loc-west'),
    name: 'Rathaus West',
    zone: 'Europe/Berlin' as any,
    openingHours: STORED_WORKING_WEEK as any,
    isActive: true,
    updatedAt: NOW,
  };

  const fakeDeps = {
    locationAdmin: {
      list: () => okAsync([storedLocation]),
      count: () => okAsync(1),
      findById: () => okAsync(storedLocation),
      create: () => okAsync(storedLocation),
      save: () => okAsync(storedLocation),
    },
    bookings: {
      list: () => okAsync([]),
      count: () => okAsync(0),
      countByState: () =>
        okAsync({
          byStatus: {
            confirmed: 10,
            held: 2,
            completed: 5,
            cancelled: 3,
            no_show: 1,
            expired: 0,
          },
          openConfirmed: 4,
        }),
    },
  };

  describe('resolveBookingFilter', () => {
    it('resolves default filter with today date and all statuses', async () => {
      const result = await resolveBookingFilter(fakeDeps as any, scope, {
        input: { websiteId: 'tenant-1', ...{} },
        now: NOW,
        maxDays: 30,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const filter = result.value;
        expect(filter.statuses).toHaveLength(6); // BOOKING_STATUSES
        expect(filter.assignment).toBeUndefined();
        expect(filter.locations.size).toBe(1);
        expect(filter.query.span).toBeDefined();
      }
    });

    it('resolves open confirmed state filter', async () => {
      const result = await resolveBookingFilter(fakeDeps as any, scope, {
        input: { websiteId: 'tenant-1', ...{ state: 'open' } },
        now: NOW,
        maxDays: 30,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.statuses).toEqual(['confirmed']);
        expect(result.value.assignment).toBe('open');
      }
    });

    it('resolves assigned confirmed state filter', async () => {
      const result = await resolveBookingFilter(fakeDeps as any, scope, {
        input: { websiteId: 'tenant-1', ...{ state: 'assigned' } },
        now: NOW,
        maxDays: 30,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.statuses).toEqual(['confirmed']);
        expect(result.value.assignment).toBe('assigned');
      }
    });

    it('resolves held state filter', async () => {
      const result = await resolveBookingFilter(fakeDeps as any, scope, {
        input: { websiteId: 'tenant-1', ...{ state: 'held' } },
        now: NOW,
        maxDays: 30,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.statuses).toEqual(['held']);
        expect(result.value.assignment).toBeUndefined();
      }
    });

    it('parses reference, locationId, serviceId, resourceId', async () => {
      const result = await resolveBookingFilter(fakeDeps as any, scope, {
        input: {
          websiteId: 'tenant-1',
          locationId: 'loc-west',
          serviceId: 'svc-passport',
          resourceId: 'res-anna',
          reference: '  ref-abc  ',
          customerEmail: 'customer@example.com',
        },
        now: NOW,
        maxDays: 30,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.query.reference).toBe('REF-ABC');
        expect(result.value.query.locationId).toBe('loc-west');
        expect(result.value.query.serviceId).toBe('svc-passport');
        expect(result.value.query.resourceId).toBe('res-anna');
        expect(result.value.query.customerEmail).toBe('customer@example.com');
      }
    });
  });

  describe('countsOf', () => {
    it('maps state counts including open and assigned confirmed counts', async () => {
      const counts = (
        await countsOf(fakeDeps as any, scope, { span: { start: NOW, end: asInstant(NOW + 1000) } })
      )._unsafeUnwrap();

      expect(counts).toEqual({
        all: 21,
        open: 4,
        assigned: 6, // 10 confirmed - 4 open = 6 assigned
        held: 2,
        completed: 5,
        cancelled: 3,
        no_show: 1,
        expired: 0,
      });
    });
  });

  describe('viewsOf', () => {
    const storedBooking1: StoredBooking = {
      tenantId: toTenantId('tenant-1'),
      booking: makeBooking({
        id: toBookingId('b-1'),
        locationId: toBookingLocationId('loc-west'),
        customer: { firstName: 'Alice', email: 'alice@example.com' },
      }),
      placement: {
        reference: 'REF-1',
        participants: 1,
        sessionKey: 'sk-1',
        sessionCapacity: 1,
        snapshot: null,
      },
    };

    const storedBookingMissingLocation: StoredBooking = {
      ...storedBooking1,
      booking: makeBooking({
        id: toBookingId('b-2'),
        locationId: toBookingLocationId('loc-missing'),
      }),
    };

    it('creates booking views with customer when withCustomer is true', () => {
      const locations = new Map([['loc-west', storedLocation as any]]);
      const views = viewsOf([storedBooking1, storedBookingMissingLocation], locations as any, {
        websiteId: toWebsiteId('website-1'),
        withCustomer: true,
      });

      expect(views).toHaveLength(1);
      expect(views[0]?.id).toBe('b-1');
      expect(views[0]?.customer).toEqual({ firstName: 'Alice', email: 'alice@example.com' });
    });

    it('masks customer when withCustomer is false', () => {
      const locations = new Map([['loc-west', storedLocation as any]]);
      const views = viewsOf([storedBooking1], locations as any, {
        websiteId: toWebsiteId('website-1'),
        withCustomer: false,
      });

      expect(views).toHaveLength(1);
      expect(views[0]?.customer).toBeNull();
    });
  });

  describe('daysView', () => {
    it('formats local date range into YYYY-MM-DD strings', () => {
      const view = daysView({
        from: { year: 2027, month: 1, day: 10 },
        to: { year: 2027, month: 1, day: 14 },
      });
      expect(view).toEqual({
        from: '2027-01-10',
        to: '2027-01-14',
      });
    });
  });
});
