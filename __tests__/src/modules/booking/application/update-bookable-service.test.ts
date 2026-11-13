// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { toActorId } from '@modules/auth/domain/models/ids';
import type { ServiceAdminDependencies } from '@modules/booking/application/booking-dependencies';
import { UpdateBookableService } from '@modules/booking/application/commands/update-bookable-service';
import type { UpdateServiceInput } from '@modules/booking/application/contracts/service-inputs';
import { toBookableServiceId, toBookingLocationId } from '@modules/booking/domain/models/ids';
import type { StoredService } from '@modules/booking/domain/models/stored-service';
import type { StoredLocation } from '@modules/booking/domain/ports/location-admin.repository';

import { forbiddenError } from '@lib/errors';
import { okAsync, errAsync } from '@lib/result';

import { TENANT } from '../support/location-fakes';
import { at, BERLIN } from '../support/time-fixtures';

describe('UpdateBookableService', () => {
  const actorId = toActorId('actor-admin-1');
  const locationId = toBookingLocationId('loc-1');
  const otherLocationId = toBookingLocationId('loc-2');
  const serviceId = toBookableServiceId('svc-1');
  const nowInstant = at('2027-01-10', '12:00');
  const version1 = at('2027-01-01', '10:00');
  const settingVersion1 = at('2027-01-01', '11:00');

  const location: StoredLocation = {
    id: locationId,
    name: 'Bürgerbüro Mitte',
    address: 'Marktplatz 1',
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
    homeLocationId: locationId,
    copiedFromLocationId: null,
    locations: [
      {
        locationId,
        isActive: true,
        isOnlineBookable: true,
        resources: [],
        updatedAt: settingVersion1,
      },
    ],
    updatedAt: version1,
  };

  const defaultInput: UpdateServiceInput = {
    websiteId: 'tenant-1',
    serviceId: String(serviceId),
    locationId: String(locationId),
    expectedVersion: new Date(version1).toISOString(),
    expectedSettingVersion: new Date(settingVersion1).toISOString(),
    name: 'Personalausweis Neu',
    description: 'Neuer Ausweis aktualisiert',
    category: 'Pässe',
    documents: ['Foto'],
    instructions: 'Ausweis prüfen',
    internalNote: 'intern',
    isOnlineBookable: true,
    isActive: true,
    durationMinutes: 30,
    preparationMinutes: 5,
    cleanupMinutes: 5,
    resources: [],
    noticeMinutes: 60,
    horizonDays: 30,
    cancelUntilMinutes: 60,
    changeUntilMinutes: 60,
    actors: ['manager'],
    employee: 'qualified',
    qualification: 'ausweise',
    acknowledgeShared: false,
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
      findById: vi.fn().mockReturnValue(okAsync(location)),
      list: vi.fn().mockReturnValue(okAsync([location])),
    },
    services: {
      findById: vi.fn().mockReturnValue(okAsync(storedService)),
      countResourceUse: vi.fn().mockReturnValue(okAsync({ counts: new Map(), isTruncated: false })),
      save: vi.fn().mockImplementation((_scope, change) => {
        const updated = {
          ...storedService,
          ...(change.service ? change.service.stored : {}),
          locations: [
            {
              ...storedService.locations[0],
              ...(change.setting ? change.setting.stored : {}),
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
    notifier: { send: vi.fn() } as any,
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

  it('fails when actor lacks booking.configure permission', async () => {
    const deps = makeDeps({
      access: {
        authorizeWebsite: vi
          .fn()
          .mockReturnValue(errAsync(forbiddenError('auth.permission_denied', 'Permission denied'))),
      },
    });
    const cmd = new UpdateBookableService(deps);
    const result = await cmd.execute(defaultInput);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('auth.permission_denied');
  });

  it('fails with validation error on invalid expected version', async () => {
    const deps = makeDeps();
    const cmd = new UpdateBookableService(deps);
    const result = await cmd.execute({ ...defaultInput, expectedVersion: 'invalid' });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('booking.validation_failed');
  });

  it('fails with not found when service does not exist', async () => {
    const deps = makeDeps({
      services: {
        ...makeDeps().services,
        findById: vi.fn().mockReturnValue(okAsync(null)),
      },
    });
    const cmd = new UpdateBookableService(deps);
    const result = await cmd.execute(defaultInput);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('booking.service_not_found');
  });

  it('fails with service_stale when versions do not match', async () => {
    const deps = makeDeps();
    const cmd = new UpdateBookableService(deps);
    const result = await cmd.execute({
      ...defaultInput,
      expectedVersion: new Date(version1 + 100000).toISOString(),
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('booking.service_stale');
  });

  it('refuses unacknowledged change to shared service offered elsewhere', async () => {
    const sharedService: StoredService = {
      ...storedService,
      locations: [
        ...storedService.locations.slice(0, 1),
        {
          locationId: otherLocationId,
          isActive: true,
          isOnlineBookable: true,
          resources: [],
          updatedAt: settingVersion1,
        },
      ],
    };
    const deps = makeDeps({
      services: {
        ...makeDeps().services,
        findById: vi.fn().mockReturnValue(okAsync(sharedService)),
      },
    });
    const cmd = new UpdateBookableService(deps);
    // Changes name (shared part) without acknowledgeShared
    const result = await cmd.execute({
      ...defaultInput,
      name: 'Radical Change',
      acknowledgeShared: false,
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('booking.service_shared_unacknowledged');
  });

  it('succeeds, records audit, and returns updated service view when acknowledged', async () => {
    const deps = makeDeps();
    const cmd = new UpdateBookableService(deps);
    const result = await cmd.execute({
      ...defaultInput,
      name: 'Personalausweis Neu',
      acknowledgeShared: true,
    });
    expect(result.isOk()).toBe(true);
    const view = result._unsafeUnwrap();
    expect(view.name).toBe('Personalausweis Neu');
    expect(deps.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'booking.service_updated',
        serviceId,
        locationId,
      }),
    );
  });

  it('returns current service view without writing if no changes were made', async () => {
    const deps = makeDeps();
    const cmd = new UpdateBookableService(deps);
    // Input matching storedService exactly
    const result = await cmd.execute({
      ...defaultInput,
      name: storedService.name,
      description: storedService.description ?? '',
      actors: ['manager'],
      qualification: 'ausweise',
    });
    expect(result.isOk()).toBe(true);
    expect(deps.services.save).not.toHaveBeenCalled();
    expect(deps.audit.record).not.toHaveBeenCalled();
  });
});
