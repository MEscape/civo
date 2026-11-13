// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { toActorId } from '@modules/auth/domain/models/ids';
import type { EmployeeAreaDependencies } from '@modules/booking/application/booking-dependencies';
import { GetEmployeeDayPlan } from '@modules/booking/application/queries/get-employee-day-plan';
import type { BookableResource } from '@modules/booking/domain/models/bookable-resource';
import type { BookableService } from '@modules/booking/domain/models/bookable-service';
import { toBookableServiceId, toBookingLocationId } from '@modules/booking/domain/models/ids';
import type { BookingLocationFacts } from '@modules/booking/domain/ports/booking-location.repository';

import { forbiddenError } from '@lib/errors';
import { okAsync, errAsync } from '@lib/result';

import { employee, makeService, MONDAY, NOW } from '../support/booking-fixtures';
import { storedBooking, TENANT } from '../support/location-fakes';
import { BERLIN, at } from '../support/time-fixtures';

describe('GetEmployeeDayPlan', () => {
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
    cancellation: { isAllowed: true, deadlineMinutes: 60 as any, allowedActors: ['employee'] },
    requirements: [{ resourceType: 'employee', skills: ['ausweise'], count: 1, resourceIds: null }],
    locations: [
      { locationId: locationFacts.id, isActive: true, isOnlineBookable: true, resources: [] },
    ],
  });

  const storedServiceRecord = {
    id: service.id,
    name: service.name,
    category: 'Pässe',
    requiredDocuments: ['Foto'],
    instructions: 'Ausweis prüfen',
    isActive: true,
    locations: [
      { locationId: locationFacts.id, isActive: true, isOnlineBookable: true, resources: [] },
    ],
  };

  const makeDeps = (
    overrides: Partial<EmployeeAreaDependencies> = {},
  ): EmployeeAreaDependencies => ({
    access: {
      authorizeWebsite: vi.fn().mockImplementation((perm) =>
        perm === 'booking.read.own'
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
      list: vi.fn().mockReturnValue(okAsync([])),
      findById: vi.fn().mockReturnValue(okAsync(null)),
    } as any,
    preferences: {} as any,
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
      findById: vi.fn().mockReturnValue(okAsync(storedServiceRecord)),
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

  it('fails if actor lacks booking.read.own permission', async () => {
    const deps = makeDeps({
      access: {
        authorizeWebsite: vi
          .fn()
          .mockReturnValue(errAsync(forbiddenError('auth.permission_denied', 'Permission denied'))),
      },
    });
    const query = new GetEmployeeDayPlan(deps);
    const result = await query.execute({ websiteId: 'tenant-1' });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('auth.permission_denied');
  });

  it('fails if invalid date is provided', async () => {
    const deps = makeDeps();
    const query = new GetEmployeeDayPlan(deps);
    const result = await query.execute({ websiteId: 'tenant-1', date: 'not-a-valid-date' });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('booking.validation_failed');
  });

  it('returns empty plan when employee is not found for actor', async () => {
    const deps = makeDeps({
      resources: {
        findEmployeeOf: vi.fn().mockReturnValue(okAsync(null)),
      } as any,
    });
    const query = new GetEmployeeDayPlan(deps);
    const result = await query.execute({ websiteId: 'tenant-1' });
    expect(result.isOk()).toBe(true);
    const plan = result._unsafeUnwrap();
    expect(plan.hasCalendar).toBe(false);
    expect(plan.items).toEqual([]);
  });

  it('returns day plan with items, next booking, and instructions', async () => {
    const start = at(MONDAY, '10:00');
    const end = at(MONDAY, '10:30');
    const stored = storedBooking('b-plan-1', locationFacts.id, start, end);
    Object.assign(stored, {
      booking: {
        ...stored.booking,
        serviceId: service.id,
        status: 'confirmed',
        assignments: [
          {
            requirementIndex: 0,
            resourceType: 'employee',
            resourceId: empResource.id,
            occupied: { start, end },
          },
        ],
      },
    });

    const deps = makeDeps({
      clock: { now: () => new Date(at(MONDAY, '09:00')) },
      bookings: {
        list: vi.fn().mockReturnValue(okAsync([stored])),
      } as any,
    });

    const query = new GetEmployeeDayPlan(deps);
    const result = await query.execute({ websiteId: 'tenant-1', date: MONDAY });
    expect(result.isOk()).toBe(true);
    const plan = result._unsafeUnwrap();
    expect(plan.hasCalendar).toBe(true);
    expect(plan.date).toBe(MONDAY);
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]?.booking.id).toBe(stored.booking.id);
    expect(plan.items[0]?.phase).toBe('upcoming');
    expect(plan.items[0]?.requiredDocuments).toEqual(['Foto']);
    expect(plan.items[0]?.instructions).toBe('Ausweis prüfen');
    expect(plan.next).toEqual({ bookingId: stored.booking.id, minutesUntil: 60 });
  });

  it('defaults to today date when input date is omitted', async () => {
    const deps = makeDeps({
      clock: { now: () => new Date(at(MONDAY, '09:00')) },
    });
    const query = new GetEmployeeDayPlan(deps);
    const result = await query.execute({ websiteId: 'tenant-1' });
    expect(result.isOk()).toBe(true);
    const plan = result._unsafeUnwrap();
    expect(plan.date).toBe(MONDAY);
    expect(plan.today).toBe(MONDAY);
  });
});
