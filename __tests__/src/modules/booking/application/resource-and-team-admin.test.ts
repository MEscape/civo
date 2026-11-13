// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { toActorId } from '@modules/auth/domain/models/ids';
import type {
  BookingDependencies,
  ResourceAdminDependencies,
} from '@modules/booking/application/booking-dependencies';
import { AssignEmployee } from '@modules/booking/application/commands/assign-employee';
import { CreateBookableResource } from '@modules/booking/application/commands/create-bookable-resource';
import { UnassignEmployee } from '@modules/booking/application/commands/unassign-employee';
import { UpdateBookableResource } from '@modules/booking/application/commands/update-bookable-resource';
import type { BookableService } from '@modules/booking/domain/models/bookable-service';
import {
  toBookableResourceId,
  toBookableServiceId,
  toBookingId,
  toBookingLocationId,
} from '@modules/booking/domain/models/ids';
import type { StoredBooking } from '@modules/booking/domain/ports/booking.repository';
import type { StoredLocation } from '@modules/booking/domain/ports/location-admin.repository';
import type { StoredResource } from '@modules/booking/domain/ports/resource-admin.repository';

import { forbiddenError } from '@lib/errors';
import { okAsync, errAsync } from '@lib/result';

import { employee, makeBooking, makeService, MONDAY } from '../support/booking-fixtures';
import { TENANT } from '../support/location-fakes';
import { at, BERLIN } from '../support/time-fixtures';

describe('Resource and Staff Assignment Administration', () => {
  const actorId = toActorId('actor-admin-1');
  const locationId = toBookingLocationId('loc-1');
  const serviceId = toBookableServiceId('svc-1');
  const resourceId = toBookableResourceId('res-room-1');
  const bookingId = toBookingId('b-assign-1');
  const nowInstant = at('2027-01-10', '12:00');
  const version1 = at('2027-01-01', '10:00');
  const slotStart = at(MONDAY, '10:00');
  const slotEnd = at(MONDAY, '10:30');

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
    updatedAt: version1,
  };

  const storedRes: StoredResource = {
    id: resourceId,
    name: 'Besprechungsraum 1',
    type: 'meeting-room',
    capacity: 4,
    locationId,
    isActive: true,
    setupMinutes: 5 as any,
    teardownMinutes: 5 as any,
    availability: null,
    internalNote: null,
    updatedAt: version1,
  };

  const empResource = employee('emp-1', {
    skills: ['ausweise'],
    locationId,
    availability: { weekly: workingSchedule, exceptions: [] },
  });

  const service: BookableService = makeService({
    id: serviceId,
    name: 'Personalausweis',
    assignmentMode: 'manual',
    rules: {
      durationMinutes: 30 as any,
      preparationMinutes: 0 as any,
      cleanupMinutes: 0 as any,
      stepMinutes: 30 as any,
    },
    requirements: [{ resourceType: 'employee', skills: ['ausweise'], count: 1, resourceIds: null }],
    locations: [{ locationId, isActive: true, isOnlineBookable: true, resources: [] }],
  });

  const makeStoredBooking = (): StoredBooking => ({
    tenantId: TENANT,
    booking: makeBooking({
      id: bookingId,
      serviceId,
      locationId,
      status: 'confirmed',
      start: slotStart,
      end: slotEnd,
      occupied: { start: slotStart, end: slotEnd },
      assignments: [
        {
          requirementIndex: 0,
          resourceType: 'employee',
          resourceId: null,
          occupied: { start: slotStart, end: slotEnd },
        },
      ],
      customer: { firstName: 'Julia', email: 'julia@example.com' },
    }),
    placement: {
      reference: 'REF123',
      participants: 1,
      sessionKey: 'session-1',
      sessionCapacity: 1,
      snapshot: null,
    },
  });

  const makeResourceDeps = (
    overrides: Partial<ResourceAdminDependencies> = {},
  ): ResourceAdminDependencies => ({
    access: {
      authorizeWebsite: vi.fn().mockImplementation((perm) =>
        perm === 'booking.configure'
          ? okAsync({
              actor: { id: actorId, tenantId: TENANT, roles: ['admin'] },
              websiteId: TENANT,
            })
          : errAsync(forbiddenError('auth.permission_denied', 'Permission denied')),
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
    },
    resources: {
      findById: vi.fn().mockReturnValue(okAsync(storedRes)),
      list: vi.fn().mockReturnValue(okAsync([storedRes])),
      create: vi
        .fn()
        .mockImplementation((_scope, newRes, now) =>
          okAsync({ ...newRes, id: toBookableResourceId('res-new'), updatedAt: now }),
        ),
      save: vi.fn().mockImplementation((_scope, change) => okAsync(change.stored)),
      listUsers: vi.fn().mockReturnValue(okAsync({ users: [], isTruncated: false })),
    } as any,
    bookings: {
      list: vi.fn().mockReturnValue(okAsync([])),
      listBlocking: vi.fn().mockReturnValue(okAsync({ bookings: [], isComplete: true })),
    },
    audit: { record: vi.fn() },
    ...overrides,
  });

  const makeBookingDeps = (overrides: Partial<BookingDependencies> = {}): BookingDependencies => ({
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
    services: {
      findById: vi.fn().mockReturnValue(okAsync(service)),
    },
    locations: {
      findById: vi.fn().mockReturnValue(okAsync(location)),
    },
    resources: {
      findEmployeeOf: vi.fn().mockReturnValue(okAsync(empResource)),
      findById: vi.fn().mockImplementation((_scope, id) => {
        if (id === empResource.id) {
          return okAsync(empResource);
        }
        if (id === storedRes.id) {
          return okAsync(storedRes);
        }
        return okAsync(null);
      }),
      // The list reads calendars of every kind: a room has no cover, like every resource but a person's.
      list: vi.fn().mockReturnValue(okAsync([empResource, { ...storedRes, coverage: [] }])),
    },
    bookings: {
      findById: vi.fn().mockReturnValue(okAsync(makeStoredBooking())),
      save: vi.fn().mockImplementation((_scope, change) => okAsync(change.stored)),
      listBlocking: vi.fn().mockReturnValue(okAsync({ bookings: [], isComplete: true })),
    } as any,
    preferences: {
      findMany: vi.fn().mockReturnValue(okAsync(new Map())),
    } as any,
    audit: { record: vi.fn() },
    notifier: { notify: vi.fn().mockReturnValue(okAsync(undefined)) },
    identity: {
      nextId: vi.fn().mockReturnValue(bookingId),
      nextReference: vi.fn().mockReturnValue('REF-TEST'),
    } as any,
    ...overrides,
  });

  describe('CreateBookableResource', () => {
    it('creates resource, records audit, and returns view', async () => {
      const deps = makeResourceDeps();
      const cmd = new CreateBookableResource(deps);
      const result = await cmd.execute({
        websiteId: 'tenant-1',
        locationId: String(locationId),
        name: 'Schalter 1',
        internalNote: '',
        type: 'service-desk',
        capacity: 1,
        setupMinutes: 5,
        teardownMinutes: 5,
        followsLocation: true,
        openingHours: { weekly: [], exceptions: [] },
      });
      expect(result.isOk()).toBe(true);
      const view = result._unsafeUnwrap();
      expect(view.name).toBe('Schalter 1');
      expect(deps.resources.create).toHaveBeenCalled();
      expect(deps.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'booking.resource_created',
          locationId,
        }),
      );
    });

    it('fails with validation error on invalid resource kind', async () => {
      const deps = makeResourceDeps();
      const cmd = new CreateBookableResource(deps);
      const result = await cmd.execute({
        websiteId: 'tenant-1',
        locationId: String(locationId),
        name: 'Invalid',
        internalNote: '',
        type: 'invalid-type',
        capacity: 1,
        setupMinutes: 0,
        teardownMinutes: 0,
        followsLocation: true,
        openingHours: { weekly: [], exceptions: [] },
      });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('booking.validation_failed');
    });
  });

  describe('UpdateBookableResource', () => {
    it('updates resource details, audits, and returns view', async () => {
      const deps = makeResourceDeps();
      const cmd = new UpdateBookableResource(deps);
      const result = await cmd.execute({
        websiteId: 'tenant-1',
        resourceId: String(resourceId),
        expectedVersion: new Date(version1).toISOString(),
        name: 'Besprechungsraum 1 Renoviert',
        internalNote: '',
        capacity: 6,
        setupMinutes: 10,
        teardownMinutes: 10,
        followsLocation: true,
        openingHours: { weekly: [], exceptions: [] },
        acknowledgeImpact: false,
      });
      expect(result.isOk()).toBe(true);
      const view = result._unsafeUnwrap();
      expect(view.name).toBe('Besprechungsraum 1 Renoviert');
      expect(deps.resources.save).toHaveBeenCalled();
      expect(deps.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'booking.resource_updated',
          resourceId,
        }),
      );
    });

    it('fails when version is stale', async () => {
      const deps = makeResourceDeps();
      const cmd = new UpdateBookableResource(deps);
      const result = await cmd.execute({
        websiteId: 'tenant-1',
        resourceId: String(resourceId),
        expectedVersion: new Date(version1 + 100000).toISOString(),
        name: 'Renoviert',
        internalNote: '',
        capacity: 6,
        setupMinutes: 10,
        teardownMinutes: 10,
        followsLocation: true,
        openingHours: { weekly: [], exceptions: [] },
        acknowledgeImpact: false,
      });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('booking.resource_stale');
    });
  });

  describe('AssignEmployee and UnassignEmployee', () => {
    it('assigns employee to open booking unit and audits it', async () => {
      const deps = makeBookingDeps();
      const cmd = new AssignEmployee(deps);
      const result = await cmd.execute({
        websiteId: 'tenant-1',
        bookingId: String(bookingId),
        resourceId: String(empResource.id),
      });
      expect(result.isOk()).toBe(true);
      expect(deps.bookings.save).toHaveBeenCalled();
      expect(deps.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'booking.assigned',
          bookingId,
          resourceId: empResource.id,
        }),
      );
    });

    it('unassigns employee from assigned booking unit and audits it', async () => {
      const assigned = makeStoredBooking();
      Object.assign(assigned.booking.assignments, {
        0: {
          requirementIndex: 0,
          resourceType: 'employee',
          resourceId: empResource.id,
          occupied: { start: slotStart, end: slotEnd },
        },
      });

      const deps = makeBookingDeps({
        bookings: {
          ...makeBookingDeps().bookings,
          findById: vi.fn().mockReturnValue(okAsync(assigned)),
        },
      });
      const cmd = new UnassignEmployee(deps);
      const result = await cmd.execute({
        websiteId: 'tenant-1',
        bookingId: String(bookingId),
        resourceId: String(empResource.id),
      });
      expect(result.isOk()).toBe(true);
      expect(deps.bookings.save).toHaveBeenCalled();
      expect(deps.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'booking.unassigned',
          bookingId,
          resourceId: empResource.id,
        }),
      );
    });
  });
});
