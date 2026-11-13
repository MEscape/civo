// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { toActorId } from '@modules/auth/domain/models/ids';
import type { BookingDependencies } from '@modules/booking/application/booking-dependencies';
import { CancelBooking } from '@modules/booking/application/commands/cancel-booking';
import { ClaimBooking } from '@modules/booking/application/commands/claim-booking';
import { RescheduleBooking } from '@modules/booking/application/commands/reschedule-booking';
import type { BookableResource } from '@modules/booking/domain/models/bookable-resource';
import type { BookableService } from '@modules/booking/domain/models/bookable-service';
import {
  toBookableServiceId,
  toBookingId,
  toBookingLocationId,
} from '@modules/booking/domain/models/ids';
import type { BookingLocationFacts } from '@modules/booking/domain/ports/booking-location.repository';
import type { StoredBooking } from '@modules/booking/domain/ports/booking.repository';

import { forbiddenError } from '@lib/errors';
import { okAsync, errAsync } from '@lib/result';

import { employee, makeBooking, makeService, MONDAY } from '../support/booking-fixtures';
import { TENANT } from '../support/location-fakes';
import { at, BERLIN } from '../support/time-fixtures';

describe('Claim, Cancel, and Reschedule Booking', () => {
  const actorId = toActorId('actor-staff-1');
  const locationId = toBookingLocationId('loc-1');
  const serviceId = toBookableServiceId('svc-1');
  const bookingId = toBookingId('b-claim-1');
  const nowInstant = at('2027-01-10', '12:00');
  const slotStart = at(MONDAY, '10:00');
  const slotEnd = at(MONDAY, '10:30');
  const newStart = at(MONDAY, '11:00');

  const workingSchedule = {
    1: { ranges: [{ startMinute: 480, endMinute: 1080 }], breaks: [] },
    2: { ranges: [{ startMinute: 480, endMinute: 1080 }], breaks: [] },
    3: { ranges: [{ startMinute: 480, endMinute: 1080 }], breaks: [] },
    4: { ranges: [{ startMinute: 480, endMinute: 1080 }], breaks: [] },
    5: { ranges: [{ startMinute: 480, endMinute: 1080 }], breaks: [] },
    6: { ranges: [], breaks: [] },
    7: { ranges: [], breaks: [] },
  };

  const locationFacts: BookingLocationFacts = {
    id: locationId,
    name: 'Bürgerbüro Mitte',
    address: 'Marktplatz 1',
    zone: BERLIN,
    isActive: true,
    openingHours: { weekly: workingSchedule, exceptions: [] },
  };

  const service: BookableService = makeService({
    id: serviceId,
    name: 'Personalausweis',
    assignmentMode: 'open',
    rules: {
      durationMinutes: 30 as any,
      preparationMinutes: 0 as any,
      cleanupMinutes: 0 as any,
      stepMinutes: 30 as any,
    },
    cancellation: {
      isAllowed: true,
      deadlineMinutes: 60 as any,
      allowedActors: ['manager', 'customer'],
    },
    rescheduling: {
      isAllowed: true,
      deadlineMinutes: 60 as any,
      allowedActors: ['manager', 'customer'],
    },
    requirements: [{ resourceType: 'employee', skills: ['ausweise'], count: 1, resourceIds: null }],
    locations: [{ locationId, isActive: true, isOnlineBookable: true, resources: [] }],
  });

  const empResource: BookableResource = employee('emp-1', {
    skills: ['ausweise'],
    locationId,
    availability: { weekly: workingSchedule, exceptions: [] },
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

  const makeDeps = (overrides: Partial<BookingDependencies> = {}): BookingDependencies => ({
    access: {
      authorizeWebsite: vi.fn().mockImplementation(() =>
        okAsync({
          actor: { id: actorId, tenantId: TENANT, roles: ['employee', 'manager'] },
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
      findById: vi.fn().mockReturnValue(okAsync(locationFacts)),
    },
    resources: {
      findEmployeeOf: vi.fn().mockReturnValue(okAsync(empResource)),
      findById: vi.fn().mockReturnValue(okAsync(empResource)),
      list: vi.fn().mockReturnValue(okAsync([empResource])),
    },
    bookings: {
      findById: vi.fn().mockReturnValue(okAsync(makeStoredBooking())),
      save: vi.fn().mockImplementation((_scope, change) => okAsync(change.stored)),
      listBlocking: vi.fn().mockReturnValue(okAsync({ bookings: [], isComplete: true })),
      listOpen: vi.fn().mockReturnValue(okAsync([])),
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

  describe('ClaimBooking', () => {
    it('claims an open booking, updates units, audits, and returns view', async () => {
      const deps = makeDeps();
      const cmd = new ClaimBooking(deps);
      const result = await cmd.execute({ websiteId: 'tenant-1', bookingId: String(bookingId) });
      expect(result.isOk()).toBe(true);
      const view = result._unsafeUnwrap();
      expect(view.id).toBe(bookingId);
      expect(deps.bookings.save).toHaveBeenCalled();
      expect(deps.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'booking.assigned',
          bookingId,
          resourceId: empResource.id,
          how: 'claim',
        }),
      );
    });

    it('is idempotent when employee already holds unit', async () => {
      const alreadyClaimed = makeStoredBooking();
      Object.assign(alreadyClaimed.booking.assignments, {
        0: {
          requirementIndex: 0,
          resourceType: 'employee',
          resourceId: empResource.id,
          occupied: { start: slotStart, end: slotEnd },
        },
      });

      const deps = makeDeps({
        bookings: {
          ...makeDeps().bookings,
          findById: vi.fn().mockReturnValue(okAsync(alreadyClaimed)),
        },
      });
      const cmd = new ClaimBooking(deps);
      const result = await cmd.execute({ websiteId: 'tenant-1', bookingId: String(bookingId) });
      expect(result.isOk()).toBe(true);
      expect(deps.bookings.save).not.toHaveBeenCalled();
    });

    it('fails when service does not permit employee claiming', async () => {
      const manualService = { ...service, assignmentMode: 'manual' as const };
      const deps = makeDeps({
        services: {
          findById: vi.fn().mockReturnValue(okAsync(manualService)),
        },
      });
      const cmd = new ClaimBooking(deps);
      const result = await cmd.execute({ websiteId: 'tenant-1', bookingId: String(bookingId) });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('booking.not_claimable');
    });
  });

  describe('CancelBooking', () => {
    it('cancels booking, records audit, announces notice, and returns view', async () => {
      const deps = makeDeps();
      const cmd = new CancelBooking(deps);
      const result = await cmd.execute({ websiteId: 'tenant-1', bookingId: String(bookingId) });
      expect(result.isOk()).toBe(true);
      const view = result._unsafeUnwrap();
      expect(view.status).toBe('cancelled');
      expect(deps.bookings.save).toHaveBeenCalled();
      expect(deps.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'booking.cancelled',
          bookingId,
        }),
      );
      expect(deps.notifier.notify).toHaveBeenCalled();
    });

    it('fails if actor lacks booking.manage permission', async () => {
      const deps = makeDeps({
        access: {
          authorizeWebsite: vi
            .fn()
            .mockReturnValue(
              errAsync(forbiddenError('auth.permission_denied', 'Permission denied')),
            ),
        },
      });
      const cmd = new CancelBooking(deps);
      const result = await cmd.execute({ websiteId: 'tenant-1', bookingId: String(bookingId) });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('auth.permission_denied');
    });
  });

  describe('RescheduleBooking', () => {
    it('moves booking to new start time, saves, audits, and notifies', async () => {
      const deps = makeDeps();
      const cmd = new RescheduleBooking(deps);
      const result = await cmd.execute({
        websiteId: 'tenant-1',
        bookingId: String(bookingId),
        start: new Date(newStart).toISOString(),
      });
      expect(result.isOk()).toBe(true);
      result._unsafeUnwrap();
      expect(deps.bookings.save).toHaveBeenCalled();
      expect(deps.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'booking.rescheduled',
          bookingId,
        }),
      );
      expect(deps.notifier.notify).toHaveBeenCalled();
    });
  });
});
