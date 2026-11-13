// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { toActorId } from '@modules/auth/domain/models/ids';
import type { ServiceAdminDependencies } from '@modules/booking/application/booking-dependencies';
import { DeactivateService } from '@modules/booking/application/commands/deactivate-service';
import type { DeactivateServiceInput } from '@modules/booking/application/contracts/service-inputs';
import {
  toBookableServiceId,
  toBookingLocationId,
  toBookingId,
} from '@modules/booking/domain/models/ids';
import type { StoredService } from '@modules/booking/domain/models/stored-service';
import type { StoredLocation } from '@modules/booking/domain/ports/location-admin.repository';

import { forbiddenError } from '@lib/errors';
import { okAsync, errAsync } from '@lib/result';

import { TENANT, storedBooking } from '../support/location-fakes';
import { at, BERLIN } from '../support/time-fixtures';

describe('DeactivateService', () => {
  const actorId = toActorId('actor-admin-1');
  const locationId = toBookingLocationId('loc-1');
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

  const defaultInput: DeactivateServiceInput = {
    websiteId: 'tenant-1',
    serviceId: String(serviceId),
    locationId: String(locationId),
    scope: 'location',
    mode: 'block-new',
    expectedVersion: new Date(version1).toISOString(),
    expectedSettingVersion: new Date(settingVersion1).toISOString(),
    resolutions: [],
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

  it('fails when actor lacks booking.configure permission', async () => {
    const deps = makeDeps({
      access: {
        authorizeWebsite: vi
          .fn()
          .mockReturnValue(errAsync(forbiddenError('auth.permission_denied', 'Permission denied'))),
      },
    });
    const cmd = new DeactivateService(deps);
    const result = await cmd.execute(defaultInput);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('auth.permission_denied');
  });

  it('fails with validation error on invalid expected version or scope', async () => {
    const deps = makeDeps();
    const cmd = new DeactivateService(deps);
    const result = await cmd.execute({ ...defaultInput, expectedVersion: 'not-an-iso' });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('booking.validation_failed');
  });

  it('fails with service_stale when settingVersion is out of date', async () => {
    const deps = makeDeps();
    const cmd = new DeactivateService(deps);
    const result = await cmd.execute({
      ...defaultInput,
      expectedSettingVersion: new Date(settingVersion1 + 50000).toISOString(),
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('booking.service_stale');
  });

  it('deactivates at location in block-new mode without cancelling existing bookings', async () => {
    const deps = makeDeps();
    const cmd = new DeactivateService(deps);
    const result = await cmd.execute(defaultInput);
    expect(result.isOk()).toBe(true);
    const view = result._unsafeUnwrap();
    expect(view.isActive).toBe(false);
    expect(deps.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'booking.service_deactivated',
        scope: 'location',
        cancelled: 0,
      }),
    );
  });

  it('deactivates for all locations when scope is all', async () => {
    const deps = makeDeps();
    const cmd = new DeactivateService(deps);
    const result = await cmd.execute({
      ...defaultInput,
      scope: 'all',
    });
    expect(result.isOk()).toBe(true);
    expect(deps.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'booking.service_deactivated',
        scope: 'all',
      }),
    );
  });

  it('reviews and cancels decided bookings in review mode', async () => {
    const bId = toBookingId('b-impact-1');
    const stored = storedBooking(
      bId,
      locationId,
      at('2027-01-15', '10:00'),
      at('2027-01-15', '10:30'),
    );
    Object.assign(stored.booking, { status: 'confirmed' });

    const deps = makeDeps({
      bookings: {
        count: vi.fn().mockReturnValue(okAsync(1)),
        list: vi.fn().mockReturnValue(okAsync([stored])),
      },
    });
    const cmd = new DeactivateService(deps);
    const result = await cmd.execute({
      ...defaultInput,
      mode: 'review',
      resolutions: [{ bookingId: bId, kind: 'cancel' }],
    });
    expect(result.isOk()).toBe(true);
    expect(deps.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'booking.service_deactivated',
        cancelled: 1,
      }),
    );
    expect(deps.notifier.notify).toHaveBeenCalled();
  });
});
