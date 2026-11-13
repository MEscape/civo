// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { toActorId } from '@modules/auth/domain/models/ids';
import type {
  ResourceAdminDependencies,
  ServiceAdminDependencies,
} from '@modules/booking/application/booking-dependencies';
import { GetResource } from '@modules/booking/application/queries/get-resource';
import { GetService } from '@modules/booking/application/queries/get-service';
import { GetServiceFormOptions } from '@modules/booking/application/queries/get-service-form-options';
import { ListAdoptableServices } from '@modules/booking/application/queries/list-adoptable-services';
import { ListOfferableServices } from '@modules/booking/application/queries/list-offerable-services';
import { ListResources } from '@modules/booking/application/queries/list-resources';
import { ListServices } from '@modules/booking/application/queries/list-services';
import {
  toBookableResourceId,
  toBookableServiceId,
  toBookingLocationId,
} from '@modules/booking/domain/models/ids';
import type { StoredService } from '@modules/booking/domain/models/stored-service';
import type { StoredLocation } from '@modules/booking/domain/ports/location-admin.repository';
import type { StoredResource } from '@modules/booking/domain/ports/resource-admin.repository';

import { forbiddenError } from '@lib/errors';
import { okAsync, errAsync } from '@lib/result';

import { makeService } from '../support/booking-fixtures';
import { TENANT } from '../support/location-fakes';
import { at, BERLIN } from '../support/time-fixtures';

describe('Service and Resource Admin Queries', () => {
  const actorId = toActorId('actor-admin-1');
  const locationId = toBookingLocationId('loc-query-1');
  const serviceId = toBookableServiceId('svc-query-1');
  const resourceId = toBookableResourceId('res-desk-1');
  const nowInstant = at('2027-01-10', '12:00');

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
    name: 'Bürgeramt West',
    address: 'Westring 10',
    zone: BERLIN,
    isActive: true,
    openingHours: { weekly: workingSchedule, exceptions: [] },
    updatedAt: nowInstant,
  };

  const storedRes: StoredResource = {
    id: resourceId,
    name: 'Schalter 1',
    type: 'service-desk',
    capacity: 1,
    locationId,
    isActive: true,
    setupMinutes: 5 as any,
    teardownMinutes: 5 as any,
    availability: null,
    internalNote: 'Erdgeschoss',
    updatedAt: nowInstant,
  };

  const baseService = makeService({
    id: serviceId,
    name: 'Führerscheinantrag',
    assignmentMode: 'automatic',
    rules: {
      durationMinutes: 20 as any,
      preparationMinutes: 0 as any,
      cleanupMinutes: 0 as any,
      stepMinutes: 20 as any,
    },
    locations: [
      {
        locationId,
        isActive: true,
        isOnlineBookable: true,
        resources: [{ resourceId, resourceType: 'room' as const, isRequired: true }],
      },
    ],
  });

  const storedService: StoredService = {
    ...baseService,
    description: 'Erstantrag',
    category: 'Fahrzeuge',
    requiredDocuments: ['Sehtest'],
    instructions: 'Biometrisches Passbild erforderlich',
    internalNote: 'Schalter',
    participantsPerBooking: 1,
    participantsPerSession: 1,
    homeLocationId: locationId,
    copiedFromLocationId: null,
    locations: [
      {
        locationId,
        isActive: true,
        isOnlineBookable: true,
        resources: [{ resourceId, resourceType: 'room' as const, isRequired: true }],
        updatedAt: nowInstant,
      },
    ],
    updatedAt: nowInstant,
  };

  const makeResourceDeps = (
    overrides: Partial<ResourceAdminDependencies> = {},
  ): ResourceAdminDependencies => ({
    access: {
      authorizeWebsite: vi.fn().mockImplementation((perm) =>
        perm === 'booking.read' || perm === 'booking.configure'
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
      list: vi.fn().mockReturnValue(okAsync([location])),
    } as any,
    resources: {
      findById: vi.fn().mockReturnValue(okAsync(storedRes)),
      list: vi.fn().mockReturnValue(okAsync([storedRes])),
      count: vi.fn().mockReturnValue(okAsync(1)),
      listUsers: vi.fn().mockReturnValue(
        okAsync({
          users: [
            {
              resourceId,
              serviceId,
              serviceName: 'Führerscheinantrag',
              isRequired: true,
            },
          ],
          isTruncated: false,
        }),
      ),
    } as any,
    bookings: {
      list: vi.fn().mockReturnValue(okAsync([])),
      listBlocking: vi.fn().mockReturnValue(okAsync({ bookings: [], isComplete: true })),
    },
    audit: { record: vi.fn() },
    ...overrides,
  });

  const makeServiceDeps = (
    overrides: Partial<ServiceAdminDependencies> = {},
  ): ServiceAdminDependencies =>
    ({
      access: {
        authorizeWebsite: vi.fn().mockImplementation((perm) =>
          perm === 'booking.read' || perm === 'booking.configure'
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
        list: vi.fn().mockReturnValue(okAsync([location])),
      },
      services: {
        findById: vi.fn().mockReturnValue(okAsync(storedService)),
        listAtLocation: vi.fn().mockReturnValue(
          okAsync({
            entries: [
              {
                id: serviceId,
                name: 'Führerscheinantrag',
                category: 'Fahrzeuge',
                durationMinutes: 20,
                isActive: true,
                homeLocationId: locationId,
                copiedFromLocationId: null,
                setting: {
                  isActive: true,
                  isOnlineBookable: true,
                },
              },
            ],
            isTruncated: false,
          }),
        ),
        listAdoptable: vi.fn().mockReturnValue(
          okAsync({
            services: [
              {
                id: toBookableServiceId('svc-adopt-1'),
                name: 'Gewerbeanmeldung',
                category: 'Wirtschaft',
                durationMinutes: 45 as any,
                homeLocationId: locationId,
                offeredAt: [locationId],
              },
            ],
            isTruncated: false,
          }),
        ),
        listCategories: vi
          .fn()
          .mockReturnValue(
            okAsync({ categories: ['Fahrzeuge', 'Wirtschaft'], isTruncated: false }),
          ),
        countResourceUse: vi
          .fn()
          .mockReturnValue(
            okAsync({ counts: new Map([[String(resourceId), 1]]), isTruncated: false }),
          ),
      } as any,
      resources: {
        findById: vi.fn().mockReturnValue(okAsync(storedRes)),
        list: vi.fn().mockReturnValue(okAsync([storedRes])),
      } as any,
      bookings: {
        count: vi.fn().mockReturnValue(okAsync(2)),
        countUpcomingForService: vi.fn().mockReturnValue(okAsync(2)),
      } as any,
      audit: { record: vi.fn() },
      ...overrides,
    }) as ServiceAdminDependencies;

  describe('ListResources', () => {
    it('fails when booking.read permission is missing', async () => {
      const deps = makeResourceDeps({
        access: {
          authorizeWebsite: vi
            .fn()
            .mockReturnValue(
              errAsync(forbiddenError('auth.permission_denied', 'Permission denied')),
            ),
        },
      });
      const query = new ListResources(deps);
      const result = await query.execute({
        websiteId: 'tenant-1',
        locationId: String(locationId),
        page: { page: 1, pageSize: 20 },
      });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('auth.permission_denied');
    });

    it('returns paged resources with usage context', async () => {
      const deps = makeResourceDeps();
      const query = new ListResources(deps);
      const result = await query.execute({
        websiteId: 'tenant-1',
        locationId: String(locationId),
        type: 'service-desk',
        page: { page: 1, pageSize: 20 },
      });
      expect(result.isOk()).toBe(true);
      const page = result._unsafeUnwrap();
      expect(page.items.length).toBe(1);
      expect(page.items[0]?.name).toBe('Schalter 1');
      expect(page.items[0]?.usedBy.length).toBe(1);
      expect(page.items[0]?.usedBy[0]?.serviceName).toBe('Führerscheinantrag');
    });
  });

  describe('GetResource', () => {
    it('returns resource view with usage details', async () => {
      const deps = makeResourceDeps();
      const query = new GetResource(deps);
      const result = await query.execute({ websiteId: 'tenant-1', resourceId: String(resourceId) });
      expect(result.isOk()).toBe(true);
      const res = result._unsafeUnwrap();
      expect(res.name).toBe('Schalter 1');
      expect(res.internalNote).toBe('Erdgeschoss');
      expect(res.places).toBe(1);
    });

    it('fails with booking.resource_not_found when resource does not exist', async () => {
      const deps = makeResourceDeps({
        resources: {
          findById: vi.fn().mockReturnValue(okAsync(null)),
        } as any,
      });
      const query = new GetResource(deps);
      const result = await query.execute({ websiteId: 'tenant-1', resourceId: 'res-non-existent' });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('booking.resource_not_found');
    });
  });

  describe('ListServices', () => {
    it('returns services at location grouped by category', async () => {
      const deps = makeServiceDeps();
      const query = new ListServices(deps);
      const result = await query.execute({
        websiteId: 'tenant-1',
        locationId: String(locationId),
        page: { page: 1, pageSize: 10 },
      });
      expect(result.isOk()).toBe(true);
      const page = result._unsafeUnwrap();
      expect(page.groups.length).toBeGreaterThan(0);
      expect(page.groups[0]?.category).toBe('Fahrzeuge');
      expect(page.groups[0]?.items.length).toBe(1);
      expect(page.groups[0]?.items[0]?.name).toBe('Führerscheinantrag');
    });
  });

  describe('GetService', () => {
    it('returns service view for configured service at location', async () => {
      const deps = makeServiceDeps();
      const query = new GetService(deps);
      const result = await query.execute({
        websiteId: 'tenant-1',
        serviceId: String(serviceId),
        locationId: String(locationId),
      });
      expect(result.isOk()).toBe(true);
      const svc = result._unsafeUnwrap();
      expect(svc.name).toBe('Führerscheinantrag');
      expect(svc.category).toBe('Fahrzeuge');
      expect(svc.durationMinutes).toBe(20);
      expect(svc.instructions).toBe('Biometrisches Passbild erforderlich');
    });
  });

  describe('ListAdoptableServices', () => {
    it('lists adoptable services offered elsewhere on website', async () => {
      const deps = makeServiceDeps();
      const query = new ListAdoptableServices(deps);
      const result = await query.execute({
        websiteId: 'tenant-1',
        locationId: String(locationId),
        page: { page: 1, pageSize: 10 },
      });
      expect(result.isOk()).toBe(true);
      const page = result._unsafeUnwrap();
      expect(page.items.length).toBe(1);
      expect(page.items[0]?.name).toBe('Gewerbeanmeldung');
      expect(page.items[0]?.category).toBe('Wirtschaft');
    });
  });

  describe('ListOfferableServices', () => {
    it('lists what a location that is not made yet could start with, asking for nothing to be excluded', async () => {
      const deps = makeServiceDeps();
      const query = new ListOfferableServices(deps);
      const result = await query.execute({ websiteId: 'tenant-1' });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().items.map((item) => item.name)).toEqual(['Gewerbeanmeldung']);
      expect(deps.services.listAdoptable).toHaveBeenCalledWith(
        expect.anything(),
        null,
        expect.any(Number),
      );
    });
  });

  describe('GetServiceFormOptions', () => {
    it('returns categories, qualifications, and serving resources for service creation', async () => {
      const deps = makeServiceDeps();
      const query = new GetServiceFormOptions(deps);
      const result = await query.execute({ websiteId: 'tenant-1', locationId: String(locationId) });
      expect(result.isOk()).toBe(true);
      const options = result._unsafeUnwrap();
      expect(options.categories).toContain('Fahrzeuge');
      expect(options.categories).toContain('Wirtschaft');
      expect(options.resources.length).toBeGreaterThan(0);
      expect(options.resources[0]?.name).toBe('Schalter 1');
    });
  });
});
