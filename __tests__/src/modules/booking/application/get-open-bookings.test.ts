// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { toActorId } from '@modules/auth/domain/models/ids';
import type { EmployeeAreaDependencies } from '@modules/booking/application/booking-dependencies';
import { GetOpenBookings } from '@modules/booking/application/queries/get-open-bookings';
import type { BookableResource } from '@modules/booking/domain/models/bookable-resource';
import type { BookableService } from '@modules/booking/domain/models/bookable-service';
import { toBookableServiceId, toBookingLocationId } from '@modules/booking/domain/models/ids';
import type { BookingLocationFacts } from '@modules/booking/domain/ports/booking-location.repository';

import { forbiddenError } from '@lib/errors';
import { okAsync, errAsync } from '@lib/result';

import { employee, makeService, MONDAY, NOW } from '../support/booking-fixtures';
import { storedBooking, TENANT } from '../support/location-fakes';
import { BERLIN, at } from '../support/time-fixtures';

describe('GetOpenBookings', () => {
  const actorId = toActorId('actor-emp-1');
  const workingSchedule = {
    1: { ranges: [{ startMinute: 480, endMinute: 1080 }], breaks: [] },
    2: { ranges: [{ startMinute: 480, endMinute: 1080 }], breaks: [] },
    3: { ranges: [{ startMinute: 480, endMinute: 1080 }], breaks: [] },
    4: { ranges: [{ startMinute: 480, endMinute: 1080 }], breaks: [] },
    5: { ranges: [{ startMinute: 480, endMinute: 1080 }], breaks: [] },
    6: { ranges: [], breaks: [] },
    7: { ranges: [], breaks: [] },
  };

  const empResource: BookableResource = employee('emp-1', {
    skills: ['ausweise'],
    locationId: toBookingLocationId('loc-1'),
    availability: {
      weekly: workingSchedule,
      exceptions: [],
    },
  });

  const locationFacts: BookingLocationFacts = {
    id: toBookingLocationId('loc-1'),
    name: 'Bürgerbüro Mitte',
    address: 'Marktplatz 1',
    zone: BERLIN,
    isActive: true,
    openingHours: {
      weekly: workingSchedule,
      exceptions: [],
    },
  };

  const service: BookableService = makeService({
    id: toBookableServiceId('svc-1'),
    name: 'Personalausweis',
    assignmentMode: 'open',
    requirements: [{ resourceType: 'employee', skills: ['ausweise'], count: 1, resourceIds: null }],
    locations: [
      { locationId: locationFacts.id, isActive: true, isOnlineBookable: true, resources: [] },
    ],
  });

  const makeDeps = (
    overrides: Partial<EmployeeAreaDependencies> = {},
  ): EmployeeAreaDependencies => ({
    access: {
      authorizeWebsite: vi.fn().mockImplementation((perm) =>
        perm === 'booking.claim.own'
          ? okAsync({
              actor: { id: actorId, tenantId: TENANT, roles: ['employee'] },
              websiteId: TENANT,
            })
          : errAsync(forbiddenError('auth.permission_denied', 'Permission denied')),
      ),
    },
    resources: {
      findEmployeeOf: vi.fn().mockReturnValue(okAsync(empResource)),
      findById: vi.fn().mockReturnValue(okAsync(empResource)),
      list: vi.fn().mockReturnValue(okAsync([empResource])),
    },
    bookings: {
      listOpen: vi.fn().mockReturnValue(okAsync([])),
      listBlocking: vi.fn().mockReturnValue(okAsync({ bookings: [], isComplete: true })),
      findById: vi.fn().mockReturnValue(okAsync(null)),
    } as any,
    preferences: {
      findMany: vi.fn().mockReturnValue(okAsync(new Map())),
    } as any,
    services: {
      findById: vi.fn().mockReturnValue(okAsync(service)),
    },
    locations: {
      findById: vi.fn().mockReturnValue(okAsync(locationFacts)),
    },
    locationAdmin: {
      list: vi.fn().mockReturnValue(okAsync([locationFacts])),
    },
    serviceAdmin: {
      findById: vi.fn().mockReturnValue(okAsync(service)),
      listAtLocation: vi.fn().mockReturnValue(okAsync({ entries: [], isTruncated: false })),
      listNames: vi.fn().mockReturnValue(
        okAsync({
          services: [{ id: service.id, name: service.name, category: null, isActive: true }],
          isTruncated: false,
        }),
      ),
    },
    messages: {} as any,
    audit: { record: vi.fn() },
    notifier: { send: vi.fn() } as any,
    identity: {} as any,
    rateLimiter: { check: vi.fn().mockReturnValue(okAsync(undefined)) } as any,
    clock: { now: () => new Date(NOW) },
    ...overrides,
  });

  it('fails if actor lacks booking.claim.own permission', async () => {
    const deps = makeDeps({
      access: {
        authorizeWebsite: vi
          .fn()
          .mockReturnValue(errAsync(forbiddenError('auth.permission_denied', 'Permission denied'))),
      },
    });
    const query = new GetOpenBookings(deps);
    const result = await query.execute({ websiteId: 'tenant-1' });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('auth.permission_denied');
  });

  it('fails if filter validation fails (e.g. invalid date string)', async () => {
    const deps = makeDeps();
    const query = new GetOpenBookings(deps);
    const result = await query.execute({ websiteId: 'tenant-1', date: 'invalid-date' });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('booking.validation_failed');
  });

  it('returns empty list if employee resource is not found for actor', async () => {
    const deps = makeDeps({
      resources: {
        findEmployeeOf: vi.fn().mockReturnValue(okAsync(null)),
      } as any,
    });
    const query = new GetOpenBookings(deps);
    const result = await query.execute({ websiteId: 'tenant-1' });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual([]);
  });

  it('returns empty list if no open bookings exist in repository', async () => {
    const deps = makeDeps({
      bookings: {
        listOpen: vi.fn().mockReturnValue(okAsync([])),
      } as any,
    });
    const query = new GetOpenBookings(deps);
    const result = await query.execute({ websiteId: 'tenant-1' });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual([]);
  });

  it('returns offered open bookings when eligible and maps labels and fit', async () => {
    const start = at(MONDAY, '10:00');
    const end = at(MONDAY, '10:30');
    const stored = storedBooking('b-open-1', locationFacts.id, start, end);
    // Unit with open requirement (resourceId: null)
    Object.assign(stored, {
      booking: {
        ...stored.booking,
        serviceId: service.id,
        assignments: [
          {
            requirementIndex: 0,
            resourceType: 'employee',
            resourceId: null,
            occupied: { start, end },
          },
        ],
      },
    });

    const deps = makeDeps({
      bookings: {
        listOpen: vi.fn().mockReturnValue(okAsync([stored])),
        listBlocking: vi.fn().mockReturnValue(okAsync({ bookings: [], isComplete: true })),
      } as any,
    });

    const query = new GetOpenBookings(deps);
    const result = await query.execute({ websiteId: 'tenant-1' });
    expect(result.isOk()).toBe(true);
    const views = result._unsafeUnwrap();
    expect(views).toHaveLength(1);
    expect(views[0]?.booking.id).toBe(stored.booking.id);
    expect(views[0]?.labels.serviceName).toBe('Personalausweis');
    expect(views[0]?.labels.locationName).toBe('Bürgerbüro Mitte');
  });

  it('excludes booking if employee already holds a unit in it', async () => {
    const start = at(MONDAY, '10:00');
    const end = at(MONDAY, '10:30');
    const stored = storedBooking('b-open-2', locationFacts.id, start, end);
    // Already holds empResource.id
    Object.assign(stored, {
      booking: {
        ...stored.booking,
        serviceId: service.id,
        assignments: [
          {
            requirementIndex: 0,
            resourceType: 'employee',
            resourceId: empResource.id,
            occupied: { start, end },
          },
          {
            requirementIndex: 1,
            resourceType: 'employee',
            resourceId: null,
            occupied: { start, end },
          },
        ],
      },
    });

    const deps = makeDeps({
      bookings: {
        listOpen: vi.fn().mockReturnValue(okAsync([stored])),
        listBlocking: vi.fn().mockReturnValue(okAsync({ bookings: [], isComplete: true })),
      } as any,
    });

    const query = new GetOpenBookings(deps);
    const result = await query.execute({ websiteId: 'tenant-1' });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toHaveLength(0);
  });
});
