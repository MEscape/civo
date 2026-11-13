// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { toActorId } from '@modules/auth/domain/models/ids';
import type { ServiceAdminDependencies } from '@modules/booking/application/booking-dependencies';
import { AdoptService } from '@modules/booking/application/commands/adopt-service';
import { CreateBookableService } from '@modules/booking/application/commands/create-bookable-service';
import { ReactivateService } from '@modules/booking/application/commands/reactivate-service';
import type {
  AdoptServiceInput,
  CreateServiceInput,
  ReactivateServiceInput,
} from '@modules/booking/application/contracts/service-inputs';
import { toBookableServiceId, toBookingLocationId } from '@modules/booking/domain/models/ids';
import type { StoredService } from '@modules/booking/domain/models/stored-service';
import type { StoredLocation } from '@modules/booking/domain/ports/location-admin.repository';

import { forbiddenError } from '@lib/errors';
import { okAsync, errAsync } from '@lib/result';

import { TENANT } from '../support/location-fakes';
import { at, BERLIN } from '../support/time-fixtures';

describe('Adopt, Reactivate, and Create Bookable Service', () => {
  const actorId = toActorId('actor-admin-1');
  const location1Id = toBookingLocationId('loc-1');
  const location2Id = toBookingLocationId('loc-2');
  const serviceId = toBookableServiceId('svc-1');
  const nowInstant = at('2027-01-10', '12:00');
  const version1 = at('2027-01-01', '10:00');
  const settingVersion1 = at('2027-01-01', '11:00');

  const location1: StoredLocation = {
    id: location1Id,
    name: 'Bürgerbüro Mitte',
    address: 'Marktplatz 1',
    zone: BERLIN,
    isActive: true,
    openingHours: { weekly: {} as any, exceptions: [] },
    updatedAt: version1,
  };

  const location2: StoredLocation = {
    id: location2Id,
    name: 'Bürgerbüro Süd',
    address: 'Südallee 5',
    zone: BERLIN,
    isActive: true,
    openingHours: { weekly: {} as any, exceptions: [] },
    updatedAt: version1,
  };

  const storedService: StoredService = {
    id: serviceId,
    name: 'Personalausweis',
    description: 'Neuer Ausweis',
    category: 'Pässe',
    requiredDocuments: ['Foto'],
    instructions: 'Ausweis prüfen',
    internalNote: 'intern',
    isActive: true,
    rules: {
      durationMinutes: 30 as any,
      preparationMinutes: 5 as any,
      cleanupMinutes: 5 as any,
      stepMinutes: 15 as any,
    },
    participantsPerBooking: 1,
    participantsPerSession: 1,
    requirements: [{ resourceType: 'employee', skills: ['ausweise'], count: 1, resourceIds: null }],
    cancellation: { isAllowed: true, deadlineMinutes: 60 as any, allowedActors: ['manager'] },
    rescheduling: { isAllowed: true, deadlineMinutes: 60 as any, allowedActors: ['manager'] },
    information: [{ field: 'firstName', isRequired: true }],
    assignmentMode: 'manual',
    availability: null,
    noticeMinutes: 60 as any,
    horizonDays: 30,
    homeLocationId: location1Id,
    copiedFromLocationId: null,
    locations: [
      {
        locationId: location1Id,
        isActive: true,
        isOnlineBookable: true,
        resources: [],
        updatedAt: settingVersion1,
      },
    ],
    updatedAt: version1,
  };

  const makeDeps = (
    overrides: Partial<ServiceAdminDependencies> = {},
  ): ServiceAdminDependencies => ({
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
    locations: {
      findById: vi.fn().mockImplementation((_scope, id) => {
        if (id === location1Id) {
          return okAsync(location1);
        }
        if (id === location2Id) {
          return okAsync(location2);
        }
        return okAsync(null);
      }),
      list: vi.fn().mockReturnValue(okAsync([location1, location2])),
    },
    services: {
      findById: vi.fn().mockReturnValue(okAsync(storedService)),
      countResourceUse: vi.fn().mockReturnValue(okAsync({ counts: new Map(), isTruncated: false })),
      enable: vi.fn().mockImplementation((_scope, req) => {
        const updated = {
          ...storedService,
          locations: [...storedService.locations, { ...req.setting, updatedAt: req.now }],
        };
        return okAsync(updated);
      }),
      create: vi.fn().mockImplementation((_scope, req, now) => {
        const created: StoredService = {
          ...req.service,
          id: toBookableServiceId('svc-created-new'),
          locations: [{ locationId: req.locationId, ...req.setting, updatedAt: now }],
          updatedAt: now,
        };
        return okAsync(created);
      }),
      save: vi.fn().mockImplementation((_scope, change) => {
        const updated = {
          ...storedService,
          isActive: change.service ? change.service.stored.isActive : storedService.isActive,
          locations: [
            {
              ...storedService.locations[0],
              isActive: change.setting
                ? change.setting.stored.isActive
                : storedService.locations[0]?.isActive,
              updatedAt: change.now,
            },
          ],
          updatedAt: change.now,
        };
        return okAsync(updated);
      }),
    } as any,
    resources: {
      list: vi.fn().mockReturnValue(okAsync([])),
    },
    bookings: {
      count: vi.fn().mockReturnValue(okAsync(0)),
      list: vi.fn().mockReturnValue(okAsync([])),
    },
    audit: { record: vi.fn() },
    notifier: { notify: vi.fn().mockReturnValue(okAsync(undefined)) },
    rateLimiter: {
      enforce: vi
        .fn()
        .mockReturnValue(
          okAsync({ limit: 100, remaining: 99, resetAfterSeconds: 60, degraded: false }),
        ),
    } as any,
    clock: { now: () => new Date(nowInstant) },
    ...overrides,
  });

  describe('CreateBookableService', () => {
    const createInput: CreateServiceInput = {
      websiteId: 'tenant-1',
      locationId: String(location1Id),
      name: 'Reisepass',
      description: 'Neuer Reisepass',
      category: 'Pässe',
      documents: ['Altes Dokument'],
      instructions: 'Biometrisches Passbild',
      internalNote: 'Express möglich',
      isOnlineBookable: true,
      isActive: true,
      durationMinutes: 20,
      preparationMinutes: 5,
      cleanupMinutes: 5,
      resources: [],
      noticeMinutes: 60,
      horizonDays: 60,
      cancelUntilMinutes: 120,
      changeUntilMinutes: 120,
      actors: ['manager', 'customer'],
      employee: 'qualified',
      qualification: 'ausweise',
    };

    it('creates a new service and audits it', async () => {
      const deps = makeDeps();
      const cmd = new CreateBookableService(deps);
      const result = await cmd.execute(createInput);
      expect(result.isOk()).toBe(true);
      const view = result._unsafeUnwrap();
      expect(view.name).toBe('Reisepass');
      expect(deps.services.create).toHaveBeenCalled();
      expect(deps.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'booking.service_created',
          locationId: location1Id,
        }),
      );
    });

    it('fails if location does not exist', async () => {
      const deps = makeDeps();
      const cmd = new CreateBookableService(deps);
      const result = await cmd.execute({ ...createInput, locationId: 'non-existent' });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('booking.location_not_found');
    });
  });

  describe('AdoptService', () => {
    const adoptInput: AdoptServiceInput = {
      websiteId: 'tenant-1',
      serviceId: String(serviceId),
      sourceLocationId: String(location1Id),
      locationId: String(location2Id),
      mode: 'link',
    };

    it('adopts service as link and audits it', async () => {
      const deps = makeDeps();
      const cmd = new AdoptService(deps);
      const result = await cmd.execute(adoptInput);
      expect(result.isOk()).toBe(true);
      expect(deps.services.enable).toHaveBeenCalled();
      expect(deps.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'booking.service_adopted',
          how: 'link',
          locationId: location2Id,
        }),
      );
    });

    it('adopts service as copy and creates new service definition', async () => {
      const deps = makeDeps();
      const cmd = new AdoptService(deps);
      const result = await cmd.execute({ ...adoptInput, mode: 'copy' });
      expect(result.isOk()).toBe(true);
      expect(deps.services.create).toHaveBeenCalled();
      expect(deps.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'booking.service_adopted',
          how: 'copy',
          locationId: location2Id,
        }),
      );
    });

    it('fails if service is already offered at target location', async () => {
      const deps = makeDeps();
      const cmd = new AdoptService(deps);
      // location1 already offers serviceId
      const result = await cmd.execute({
        ...adoptInput,
        locationId: String(location1Id),
      });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('booking.service_already_offered');
    });

    it('fails if mode is invalid', async () => {
      const deps = makeDeps();
      const cmd = new AdoptService(deps);
      const result = await cmd.execute({
        ...adoptInput,
        mode: 'invalid-mode',
      });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('booking.validation_failed');
    });
  });

  describe('ReactivateService', () => {
    const reactivateInput: ReactivateServiceInput = {
      websiteId: 'tenant-1',
      serviceId: String(serviceId),
      locationId: String(location1Id),
      scope: 'location',
      expectedVersion: new Date(version1).toISOString(),
      expectedSettingVersion: new Date(settingVersion1).toISOString(),
    };

    it('reactivates service at location and audits it', async () => {
      const deps = makeDeps();
      const cmd = new ReactivateService(deps);
      const result = await cmd.execute(reactivateInput);
      expect(result.isOk()).toBe(true);
      expect(deps.services.save).toHaveBeenCalled();
      expect(deps.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'booking.service_reactivated',
          scope: 'location',
        }),
      );
    });

    it('reactivates service across all locations when scope is all', async () => {
      const deps = makeDeps();
      const cmd = new ReactivateService(deps);
      const result = await cmd.execute({
        ...reactivateInput,
        scope: 'all',
      });
      expect(result.isOk()).toBe(true);
      expect(deps.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'booking.service_reactivated',
          scope: 'all',
        }),
      );
    });

    it('fails if version is stale', async () => {
      const deps = makeDeps();
      const cmd = new ReactivateService(deps);
      const result = await cmd.execute({
        ...reactivateInput,
        expectedSettingVersion: new Date(settingVersion1 + 99999).toISOString(),
      });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('booking.service_stale');
    });
  });
});
