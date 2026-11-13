// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { toActorId } from '@modules/auth/domain/models/ids';
import type { EmployeeAreaDependencies } from '@modules/booking/application/booking-dependencies';
import { CountUnreadMessages } from '@modules/booking/application/queries/count-unread-messages';
import { GetBooking } from '@modules/booking/application/queries/get-booking';
import { ListBookings } from '@modules/booking/application/queries/list-bookings';
import { ListMessages } from '@modules/booking/application/queries/list-messages';
import {
  toBookableResourceId,
  toBookableServiceId,
  toBookingId,
  toBookingLocationId,
} from '@modules/booking/domain/models/ids';
import type { StoredService } from '@modules/booking/domain/models/stored-service';
import type { StoredBooking } from '@modules/booking/domain/ports/booking.repository';
import type { StoredLocation } from '@modules/booking/domain/ports/location-admin.repository';

import { forbiddenError } from '@lib/errors';
import { okAsync, errAsync } from '@lib/result';

import { employee, makeBooking, makeService, MONDAY } from '../support/booking-fixtures';
import { TENANT } from '../support/location-fakes';
import { BERLIN, at } from '../support/time-fixtures';

describe('Booking Queries and Messaging Use Cases', () => {
  const actorId = toActorId('actor-emp-1');
  const otherActorId = toActorId('actor-other-2');
  const locationId = toBookingLocationId('loc-1');
  const serviceId = toBookableServiceId('svc-1');
  const bookingId = toBookingId('b-query-1');
  const resourceId = toBookableResourceId('res-emp-1');

  const nowInstant = at('2027-01-10', '12:00');
  const slotStart = at(MONDAY, '10:00');

  const workingSchedule = {
    1: { ranges: [{ startMinute: 480, endMinute: 1080 }], breaks: [] },
    2: { ranges: [{ startMinute: 480, endMinute: 1080 }], breaks: [] },
    3: { ranges: [{ startMinute: 480, endMinute: 1080 }], breaks: [] },
    4: { ranges: [{ startMinute: 480, endMinute: 1080 }], breaks: [] },
    5: { ranges: [{ startMinute: 480, endMinute: 1080 }], breaks: [] },
    6: { ranges: [], breaks: [] },
    7: { ranges: [], breaks: [] },
  };

  const location: StoredLocation = {
    id: locationId,
    name: 'Bürgerbüro Mitte',
    address: 'Marktplatz 1',
    zone: BERLIN,
    isActive: true,
    openingHours: { weekly: workingSchedule, exceptions: [] },
    updatedAt: nowInstant,
  };

  const service = makeService({
    id: serviceId,
    name: 'Personalausweis Beantragung',
    assignmentMode: 'manual',
    rules: {
      durationMinutes: 30 as any,
      preparationMinutes: 0 as any,
      cleanupMinutes: 0 as any,
      stepMinutes: 30 as any,
    },
    locations: [{ locationId, isActive: true, isOnlineBookable: true, resources: [] }],
  });

  const storedService: StoredService = {
    ...service,
    description: 'Neubeantragung',
    category: 'Ausweise',
    instructions: 'Bitte Passfoto mitbringen',
    requiredDocuments: ['Geburtsurkunde'],
    internalNote: null,
    participantsPerBooking: 1,
    participantsPerSession: 1,
    homeLocationId: null,
    copiedFromLocationId: null,
    locations: service.locations.map((setting) => ({ ...setting, updatedAt: nowInstant })),
    updatedAt: nowInstant,
  };

  const booking = makeBooking({
    id: bookingId,
    locationId,
    serviceId,
    status: 'confirmed',
    customer: {
      firstName: 'Erika',
      lastName: 'Mustermann',
      email: 'erika@example.de',
      phone: '+49123456789',
    },
  });

  const storedBooking: StoredBooking = {
    tenantId: TENANT,
    booking,
    placement: {
      reference: 'BK-100',
      participants: 1,
      sessionKey: 'session-1',
      sessionCapacity: 1,
      snapshot: null,
    },
  };

  const empResource = employee('emp-1', {
    id: resourceId,
    skills: ['ausweise'],
    locationId,
    availability: { weekly: workingSchedule, exceptions: [] },
  });

  const makeDeps = (overrides: Partial<EmployeeAreaDependencies> = {}): EmployeeAreaDependencies =>
    ({
      access: {
        authorizeWebsite: vi.fn().mockImplementation(() =>
          okAsync({
            actor: { id: actorId, tenantId: TENANT, roles: ['manager'] },
            websiteId: TENANT,
          }),
        ),
      },
      rateLimiter: {
        enforce: vi
          .fn()
          .mockReturnValue(
            okAsync({ limit: 100, remaining: 99, resetAfterSeconds: 60, degraded: false }),
          ),
      } as any,
      clock: { now: () => new Date(nowInstant) },
      locations: {
        findById: vi.fn().mockReturnValue(okAsync(location)),
        list: vi.fn().mockReturnValue(okAsync([location])),
      } as any,
      locationAdmin: {
        list: vi.fn().mockReturnValue(okAsync([location])),
      },
      resources: {
        findById: vi.fn().mockReturnValue(okAsync(empResource)),
        findEmployeeOf: vi.fn().mockReturnValue(okAsync(empResource)),
        list: vi.fn().mockReturnValue(okAsync([empResource])),
      },
      bookings: {
        findById: vi.fn().mockReturnValue(okAsync(storedBooking)),
        list: vi.fn().mockReturnValue(okAsync([storedBooking])),
        count: vi.fn().mockReturnValue(okAsync(1)),
        countByState: vi.fn().mockReturnValue(
          okAsync({
            byStatus: { confirmed: 1 },
            openConfirmed: 1,
          }),
        ),
      } as any,
      services: {
        findById: vi.fn().mockReturnValue(okAsync(service)),
      },
      serviceAdmin: {
        findById: vi.fn().mockReturnValue(okAsync(storedService)),
        listAtLocation: vi.fn().mockReturnValue(okAsync({ entries: [], isTruncated: false })),
        listNames: vi.fn().mockReturnValue(
          okAsync({
            services: [{ id: serviceId, name: 'Personalausweis', category: null, isActive: true }],
            isTruncated: false,
          }),
        ),
      },
      messages: {
        list: vi.fn().mockReturnValue(
          okAsync({
            items: [
              {
                id: 'msg-1',
                type: 'booking_assigned',
                bookingId,
                serviceId,
                locationId,
                start: slotStart,
                createdAt: nowInstant,
                readAt: null,
              },
            ],
            total: 1,
            unread: 1,
          }),
        ),
        countUnread: vi.fn().mockReturnValue(okAsync(3)),
      } as any,
      audit: { record: vi.fn() },
      ...overrides,
    }) as EmployeeAreaDependencies;

  describe('ListBookings', () => {
    it('fails when booking.read permission is missing', async () => {
      const deps = makeDeps({
        access: {
          authorizeWebsite: vi
            .fn()
            .mockReturnValue(
              errAsync(forbiddenError('auth.permission_denied', 'Permission denied')),
            ),
        },
      });
      const query = new ListBookings(deps);
      const result = await query.execute({
        websiteId: 'tenant-1',
        page: { page: 1, pageSize: 25 },
      });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('auth.permission_denied');
    });

    it('returns bookings with customer details when user may contact customers', async () => {
      const deps = makeDeps();
      const query = new ListBookings(deps);
      const result = await query.execute({
        websiteId: 'tenant-1',
        from: '2027-01-11',
        to: '2027-01-11',
        state: 'open',
        page: { page: 1, pageSize: 25 },
      });
      expect(result.isOk()).toBe(true);
      const page = result._unsafeUnwrap();
      expect(page.items.length).toBeGreaterThan(0);
      expect(page.items[0]?.customer?.firstName).toBe('Erika');
      expect(page.counts.open).toBe(1);
    });

    it('masks customer information when actor does not have contact permission', async () => {
      const deps = makeDeps({
        access: {
          authorizeWebsite: vi.fn().mockImplementation((perm) =>
            perm === 'booking.read'
              ? okAsync({
                  actor: { id: actorId, tenantId: TENANT, roles: ['viewer'] },
                  websiteId: TENANT,
                })
              : errAsync(forbiddenError('auth.permission_denied', 'Permission denied')),
          ),
        },
      });
      const query = new ListBookings(deps);
      const result = await query.execute({
        websiteId: 'tenant-1',
        page: { page: 1, pageSize: 25 },
      });
      expect(result.isOk()).toBe(true);
      const page = result._unsafeUnwrap();
      expect(page.items[0]?.customer).toBeNull();
    });
  });

  describe('GetBooking', () => {
    it('returns full booking details with staff changes for managers', async () => {
      const deps = makeDeps();
      const query = new GetBooking(deps);
      const result = await query.execute({ websiteId: 'tenant-1', bookingId: String(bookingId) });
      expect(result.isOk()).toBe(true);
      const detail = result._unsafeUnwrap();
      expect(detail.id).toBe(bookingId);
      expect(detail.customer?.firstName).toBe('Erika');
      expect(detail.staffChanges).toBeDefined();
    });

    it('returns booking without customer for read-only viewer', async () => {
      const deps = makeDeps({
        access: {
          authorizeWebsite: vi.fn().mockImplementation((perm) =>
            perm === 'booking.read' || perm === 'booking.read.own'
              ? okAsync({
                  actor: { id: otherActorId, tenantId: TENANT, roles: ['viewer'] },
                  websiteId: TENANT,
                })
              : errAsync(forbiddenError('auth.permission_denied', 'Permission denied')),
          ),
        },
      });
      const query = new GetBooking(deps);
      const result = await query.execute({ websiteId: 'tenant-1', bookingId: String(bookingId) });
      expect(result.isOk()).toBe(true);
      const detail = result._unsafeUnwrap();
      expect(detail.customer).toBeNull();
    });

    it('returns bookingNotFound when employee does not hold booking unit', async () => {
      const deps = makeDeps({
        access: {
          authorizeWebsite: vi.fn().mockImplementation((perm) =>
            perm === 'booking.read.own'
              ? okAsync({
                  actor: { id: otherActorId, tenantId: TENANT, roles: ['employee'] },
                  websiteId: TENANT,
                })
              : errAsync(forbiddenError('auth.permission_denied', 'Permission denied')),
          ),
        },
        resources: {
          findById: vi.fn().mockReturnValue(okAsync(empResource)),
          findEmployeeOf: vi
            .fn()
            .mockReturnValue(
              okAsync(employee('emp-other', { id: toBookableResourceId('res-other') })),
            ),
        } as any,
      });
      const query = new GetBooking(deps);
      const result = await query.execute({ websiteId: 'tenant-1', bookingId: String(bookingId) });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('booking.not_found');
    });
  });

  describe('ListMessages and CountUnreadMessages', () => {
    it('lists employee messages mapped with formatted dates and unread count', async () => {
      const deps = makeDeps();
      const query = new ListMessages(deps);
      const result = await query.execute({ websiteId: 'tenant-1', page: 1 });
      expect(result.isOk()).toBe(true);
      const page = result._unsafeUnwrap();
      expect(page.items.length).toBe(1);
      expect(page.items[0]).toMatchObject({ serviceName: 'Personalausweis Beantragung' });
      expect(page.items[0]?.locationName).toBe('Bürgerbüro Mitte');
      expect(page.unread).toBe(1);
    });

    it('counts unread messages for the signed-in actor', async () => {
      const deps = makeDeps();
      const query = new CountUnreadMessages(deps);
      const result = await query.execute({ websiteId: 'tenant-1' });
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBe(3);
    });
  });
});
