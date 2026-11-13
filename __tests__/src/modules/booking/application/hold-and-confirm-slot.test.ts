// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import type { BookingFlowDependencies } from '@modules/booking/application/booking-dependencies';
import { ConfirmBooking } from '@modules/booking/application/commands/confirm-booking';
import { HoldSlot } from '@modules/booking/application/commands/hold-slot';
import { ReleaseHold } from '@modules/booking/application/commands/release-hold';
import type {
  ConfirmBookingInput,
  HoldSlotInput,
  ReleaseHoldInput,
} from '@modules/booking/application/contracts/booking-inputs';
import type { BookableService } from '@modules/booking/domain/models/bookable-service';
import {
  toBookableServiceId,
  toBookingId,
  toBookingLocationId,
  toWebsiteId,
} from '@modules/booking/domain/models/ids';
import type { BookingLocationFacts } from '@modules/booking/domain/ports/booking-location.repository';
import type { StoredBooking } from '@modules/booking/domain/ports/booking.repository';

import { okAsync } from '@lib/result';

import { employee, makeBooking, makeService, MONDAY } from '../support/booking-fixtures';
import { TENANT } from '../support/location-fakes';
import { at, BERLIN } from '../support/time-fixtures';

describe('HoldSlot, ConfirmBooking, and ReleaseHold', () => {
  const websiteId = toWebsiteId('site-1');
  const locationId = toBookingLocationId('loc-1');
  const serviceId = toBookableServiceId('svc-1');
  const bookingId = toBookingId('b-test-1');
  const nowInstant = at('2027-01-10', '12:00');
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
    rules: {
      durationMinutes: 30 as any,
      preparationMinutes: 0 as any,
      cleanupMinutes: 0 as any,
      stepMinutes: 30 as any,
    },
    cancellation: { isAllowed: true, deadlineMinutes: 60 as any, allowedActors: ['customer'] },
    rescheduling: { isAllowed: true, deadlineMinutes: 60 as any, allowedActors: ['customer'] },
    information: [
      { field: 'firstName', isRequired: true },
      { field: 'email', isRequired: true },
    ],
    assignmentMode: 'automatic',
    requirements: [{ resourceType: 'employee', skills: ['ausweise'], count: 1, resourceIds: null }],
    locations: [{ locationId, isActive: true, isOnlineBookable: true, resources: [] }],
  });

  const empResource = employee('emp-1', {
    skills: ['ausweise'],
    locationId,
    availability: { weekly: workingSchedule, exceptions: [] },
  });

  const makeStoredHold = (): StoredBooking => ({
    tenantId: TENANT,
    booking: makeBooking({
      id: bookingId,
      serviceId,
      locationId,
      status: 'held',
      start: slotStart,
      end: slotEnd,
      holdExpiresAt: at('2027-01-10', '12:15'),
      customer: { firstName: 'Julia', email: 'julia@example.com' },
    }),
    placement: {
      reference: 'HOLD123',
      participants: 1,
      sessionKey: 'session-1',
      sessionCapacity: 1,
      snapshot: null,
    },
  });

  const makeDeps = (overrides: Partial<BookingFlowDependencies> = {}): BookingFlowDependencies => ({
    websites: {
      findTenantOf: vi
        .fn()
        .mockImplementation((id) => (id === String(websiteId) ? okAsync(TENANT) : okAsync(null))),
    },
    clientAddress: {
      current: vi.fn().mockResolvedValue({ kind: 'client', address: '192.168.1.1' }),
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
      list: vi.fn().mockReturnValue(okAsync([empResource])),
      findById: vi.fn().mockReturnValue(okAsync(empResource)),
    } as any,
    bookings: {
      findById: vi.fn().mockReturnValue(okAsync(makeStoredHold())),
      countLiveHolds: vi.fn().mockReturnValue(okAsync(0)),
      countLiveByEmail: vi.fn().mockReturnValue(okAsync(0)),
      create: vi
        .fn()
        .mockImplementation((_scope, newBooking) => okAsync({ ...newBooking, tenantId: TENANT })),
      save: vi.fn().mockImplementation((_scope, change) => okAsync(change.stored)),
      listBlocking: vi.fn().mockReturnValue(okAsync({ bookings: [], isComplete: true })),
      listOpen: vi.fn().mockReturnValue(okAsync([])),
    } as any,
    identity: {
      nextId: vi.fn().mockReturnValue(bookingId),
      nextReference: vi.fn().mockReturnValue('REF-TEST'),
    } as any,
    audit: { record: vi.fn() },
    notifier: { notify: vi.fn().mockReturnValue(okAsync(undefined)) },
    ...overrides,
  });

  describe('HoldSlot', () => {
    const holdInput: HoldSlotInput = {
      websiteId: String(websiteId),
      serviceId: String(serviceId),
      locationId: String(locationId),
      start: new Date(slotStart).toISOString(),
    };

    it('fails when website is not found', async () => {
      const deps = makeDeps();
      const cmd = new HoldSlot(deps);
      const result = await cmd.execute({ ...holdInput, websiteId: 'non-existent' });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('booking.website_not_found');
    });

    it('successfully reserves slot and audits booking.held', async () => {
      const deps = makeDeps();
      const cmd = new HoldSlot(deps);
      const result = await cmd.execute(holdInput);
      expect(result.isOk()).toBe(true);
      const view = result._unsafeUnwrap();
      expect(view.status).toBe('held');
      expect(deps.bookings.create).toHaveBeenCalled();
      expect(deps.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'booking.held',
          bookingId,
          serviceId,
        }),
      );
    });

    it('fails when live holds cap is exceeded', async () => {
      const deps = makeDeps({
        bookings: {
          ...makeDeps().bookings,
          countLiveHolds: vi.fn().mockReturnValue(okAsync(10000)),
        },
      });
      const cmd = new HoldSlot(deps);
      const result = await cmd.execute(holdInput);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('booking.too_many_holds');
    });
  });

  describe('ConfirmBooking', () => {
    const confirmInput: ConfirmBookingInput = {
      websiteId: String(websiteId),
      bookingId: String(bookingId),
      customer: { firstName: 'Julia', email: 'julia@example.com' },
    };

    it('confirms hold, saves booking, audits, and notifies customer', async () => {
      const deps = makeDeps();
      const cmd = new ConfirmBooking(deps);
      const result = await cmd.execute(confirmInput);
      expect(result.isOk()).toBe(true);
      const view = result._unsafeUnwrap();
      expect(view.status).toBe('confirmed');
      expect(deps.bookings.save).toHaveBeenCalled();
      expect(deps.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'booking.confirmed',
          bookingId,
          serviceId,
        }),
      );
      expect(deps.notifier.notify).toHaveBeenCalled();
    });

    it('is idempotent when confirming already confirmed booking with same email', async () => {
      const alreadyConfirmed = makeStoredHold();
      Object.assign(alreadyConfirmed.booking, { status: 'confirmed' });
      Object.assign(alreadyConfirmed.booking, {
        customer: { firstName: 'Julia', email: 'julia@example.com' },
      });

      const deps = makeDeps({
        bookings: {
          ...makeDeps().bookings,
          findById: vi.fn().mockReturnValue(okAsync(alreadyConfirmed)),
        },
      });
      const cmd = new ConfirmBooking(deps);
      const result = await cmd.execute(confirmInput);
      expect(result.isOk()).toBe(true);
      expect(deps.bookings.save).not.toHaveBeenCalled();
    });

    it('fails when email exceeds live bookings cap', async () => {
      const deps = makeDeps({
        bookings: {
          ...makeDeps().bookings,
          countLiveByEmail: vi.fn().mockReturnValue(okAsync(20)),
        },
      });
      const cmd = new ConfirmBooking(deps);
      const result = await cmd.execute(confirmInput);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('booking.too_many_bookings');
    });
  });

  describe('ReleaseHold', () => {
    const releaseInput: ReleaseHoldInput = {
      websiteId: String(websiteId),
      bookingId: String(bookingId),
    };

    it('releases hold and returns view', async () => {
      const deps = makeDeps();
      const cmd = new ReleaseHold(deps);
      const result = await cmd.execute(releaseInput);
      expect(result.isOk()).toBe(true);
      const view = result._unsafeUnwrap();
      expect(view.status).toBe('cancelled');
      expect(deps.bookings.save).toHaveBeenCalled();
    });

    it('is idempotent if hold was already cancelled', async () => {
      const alreadyCancelled = makeStoredHold();
      Object.assign(alreadyCancelled.booking, { status: 'cancelled' });

      const deps = makeDeps({
        bookings: {
          ...makeDeps().bookings,
          findById: vi.fn().mockReturnValue(okAsync(alreadyCancelled)),
        },
      });
      const cmd = new ReleaseHold(deps);
      const result = await cmd.execute(releaseInput);
      expect(result.isOk()).toBe(true);
      expect(deps.bookings.save).not.toHaveBeenCalled();
    });
  });
});
