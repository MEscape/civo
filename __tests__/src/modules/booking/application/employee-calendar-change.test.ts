import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toActorId, toTenantId } from '@modules/auth';
import {
  changeCalendar,
  locationOfEmployee,
  previewCalendar,
} from '@modules/booking/application/services/employee-calendar-change';
import { checkInsideLocation } from '@modules/booking/application/services/parse-employee-calendar';
import { findResourceImpact } from '@modules/booking/application/services/resource-impact';
import {
  toBookableResourceId,
  toBookingId,
  toBookingLocationId,
  toWebsiteId,
} from '@modules/booking/domain/models/ids';
import type { BookingScope } from '@modules/booking/domain/ports/booking.repository';
import type { StoredLocation } from '@modules/booking/domain/ports/location-admin.repository';
import type { StoredEmployee } from '@modules/booking/domain/ports/team.repository';

import { err, ok, okAsync } from '@lib/result';

import { makeBooking, unitOf } from '../support/booking-fixtures';
import { BERLIN, at, day } from '../support/time-fixtures';

vi.mock('@modules/booking/application/services/resource-impact', () => ({
  findResourceImpact: vi.fn(),
}));

vi.mock('@modules/booking/application/services/parse-employee-calendar', () => ({
  checkInsideLocation: vi.fn(),
}));

describe('employee-calendar-change service', () => {
  const scope: BookingScope = {
    tenantId: toTenantId('tenant-1'),
    websiteId: toWebsiteId('web-1'),
  };

  const now = at('2027-01-10', '12:00');
  const expectedVersion = at('2027-01-05', '09:00');

  const location: StoredLocation = {
    id: toBookingLocationId('loc-1'),
    name: 'Bürgeramt Mitte',
    address: 'Alexanderplatz 1',
    zone: BERLIN,
    isActive: true,
    openingHours: {
      weekly: {} as any,
      exceptions: [],
    },
    updatedAt: at('2027-01-01', '08:00'),
  };

  const employee: StoredEmployee = {
    id: toBookableResourceId('emp-1'),
    actorId: toActorId('actor-1'),
    name: 'Anna Schmidt',
    locationId: location.id,
    skills: ['passport'],
    isActive: true,
    availability: null,
    coverage: [],
    updatedAt: expectedVersion,
  };

  const nextCalendar = {
    weekly: {} as any,
    absences: [],
    qualifications: ['passport', 'driver_license'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('locationOfEmployee', () => {
    it('returns location when found in repository', async () => {
      const deps = {
        locations: {
          findById: vi.fn().mockReturnValue(okAsync(location)),
        },
      };

      const result = await locationOfEmployee(deps, scope, employee);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual(location);
    });

    it('returns not found error when location is missing', async () => {
      const deps = {
        locations: {
          findById: vi.fn().mockReturnValue(okAsync(null)),
        },
      };

      const result = await locationOfEmployee(deps, scope, employee);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('booking.location_not_found');
    });
  });

  describe('previewCalendar', () => {
    it('fails if new weekly hours fall outside location opening hours', async () => {
      vi.mocked(checkInsideLocation).mockReturnValue(
        err({ kind: 'validation', code: 'booking.outside_opening_hours' } as any),
      );

      const deps = { bookings: {} as any, locations: { findById: vi.fn() } };
      const result = await previewCalendar(deps, {
        scope,
        employee,
        location,
        next: nextCalendar,
        now,
      });

      expect(result.isErr()).toBe(true);
      expect(findResourceImpact).not.toHaveBeenCalled();
    });

    it('delegates to findResourceImpact when hours check passes', async () => {
      vi.mocked(checkInsideLocation).mockReturnValue(ok({} as never));
      vi.mocked(findResourceImpact).mockReturnValue(okAsync({ affected: [], isTruncated: false }));

      const deps = { bookings: {} as any, locations: { findById: vi.fn() } };
      const result = await previewCalendar(deps, {
        scope,
        employee,
        location,
        next: nextCalendar,
        now,
      });

      expect(result.isOk()).toBe(true);
      expect(findResourceImpact).toHaveBeenCalled();
    });

    it('asks about every place the person is, or is going to be, used', async () => {
      vi.mocked(findResourceImpact).mockClear();
      vi.mocked(checkInsideLocation).mockReturnValue(ok({} as never));
      vi.mocked(findResourceImpact).mockReturnValue(okAsync({ affected: [], isTruncated: false }));
      const other = { ...location, id: toBookingLocationId('loc-2') };
      const deps = {
        bookings: {} as any,
        locations: { findById: vi.fn().mockReturnValue(okAsync(other)) },
      };

      const result = await previewCalendar(deps, {
        scope,
        employee,
        location,
        next: {
          ...nextCalendar,
          coverage: [{ locationId: other.id, from: day('2027-02-01'), to: day('2027-02-03') }],
        },
        now,
      });

      expect(result.isOk()).toBe(true);
      // Their own location (the days they are away from it) and the one they are sent to.
      expect(
        vi.mocked(findResourceImpact).mock.calls.map(([, asked]) => asked.location.id),
      ).toEqual([location.id, other.id]);
      expect(vi.mocked(findResourceImpact).mock.calls[1]?.[1].placed).toEqual({
        home: employee.locationId,
      });
    });
  });

  describe('changeCalendar', () => {
    it('refuses change when expected version does not match employee updatedAt (stale)', async () => {
      const deps = {
        bookings: {} as any,
        locations: {} as any,
        team: {} as any,
        audit: { record: vi.fn() },
      };

      const result = await changeCalendar(deps, {
        scope,
        employee,
        next: nextCalendar,
        expected: at('2020-01-01', '00:00'), // stale
        now,
        acknowledgeImpact: false,
        byManager: false,
        actorId: employee.actorId,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('booking.resource_stale');
    });

    it('refuses change if bookings are affected and acknowledgeImpact is false', async () => {
      vi.mocked(checkInsideLocation).mockReturnValue(ok({} as never));
      vi.mocked(findResourceImpact).mockReturnValue(
        okAsync({
          affected: [{ bookingId: 'b-1' } as any],
          isTruncated: false,
        }),
      );

      const deps = {
        locations: { findById: vi.fn().mockReturnValue(okAsync(location)) },
        bookings: {} as any,
        team: {} as any,
        audit: { record: vi.fn() },
      };

      const result = await changeCalendar(deps, {
        scope,
        employee,
        next: {
          weekly: { 1: [] } as any, // changed hours
          absences: [],
        },
        expected: expectedVersion,
        now,
        acknowledgeImpact: false,
        byManager: true,
        actorId: employee.actorId,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('booking.resource_impact_unacknowledged');
    });

    it('saves a calendar change made by a manager', async () => {
      vi.mocked(checkInsideLocation).mockReturnValue(ok({} as never));
      vi.mocked(findResourceImpact).mockReturnValue(okAsync({ affected: [], isTruncated: false }));

      const savedEmployee = { ...employee, updatedAt: now };
      const deps = {
        locations: { findById: vi.fn().mockReturnValue(okAsync(location)) },
        bookings: {} as any,
        team: {
          save: vi.fn().mockReturnValue(okAsync(savedEmployee)),
        },
      };

      const result = await changeCalendar(deps as any, {
        scope,
        employee,
        next: nextCalendar,
        expected: expectedVersion,
        now,
        acknowledgeImpact: true,
        byManager: true,
        actorId: employee.actorId,
      });

      expect(result.isOk()).toBe(true);
      const res = result._unsafeUnwrap();
      expect(res.saved).toEqual(savedEmployee);
      expect(deps.team.save).toHaveBeenCalled();
    });

    it('makes the bookings the change leaves without the employee open again, in the same step', async () => {
      vi.mocked(checkInsideLocation).mockReturnValue(ok({} as never));
      vi.mocked(findResourceImpact).mockReturnValue(
        okAsync({
          affected: [{ bookingId: 'b-1' } as any, { bookingId: 'b-2' } as any],
          isTruncated: false,
        }),
      );
      const savedEmployee = { ...employee, updatedAt: now };
      const held = (id: string) => ({
        tenantId: scope.tenantId,
        placement: {},
        booking: makeBooking({
          id: toBookingId(id),
          status: 'confirmed',
          start: at('2027-02-01', '10:00'),
          end: at('2027-02-01', '10:30'),
          assignments: [unitOf(String(employee.id))],
        }),
      });
      const save = vi.fn().mockImplementation((_scope, change) => okAsync(change.stored));
      const deps = {
        locations: { findById: vi.fn().mockReturnValue(okAsync(location)) },
        bookings: {
          findById: vi.fn().mockImplementation((_scope, id) => okAsync(held(String(id)))),
          save,
        },
        team: { save: vi.fn().mockReturnValue(okAsync(savedEmployee)) },
        audit: { record: vi.fn() },
      };

      const result = await changeCalendar(deps as any, {
        scope,
        employee,
        next: { weekly: { 1: [] } as any, absences: [] }, // changed hours
        expected: expectedVersion,
        now,
        acknowledgeImpact: true,
        byManager: true,
        actorId: employee.actorId,
      });

      expect(result._unsafeUnwrap().leftOpen).toBe(2);
      expect(save).toHaveBeenCalledTimes(2);
      expect(save.mock.calls[0]?.[1].stored.booking.assignments[0].resourceId).toBeNull();
      expect(save.mock.calls[0]?.[1].stored.booking.status).toBe('confirmed');
      // Employee told in the same write as for any change to their part.
      expect(save.mock.calls[0]?.[1].notices).toEqual([
        { resourceId: employee.id, type: 'unassigned' },
      ]);
      expect(deps.audit.record).toHaveBeenCalledTimes(2);
    });

    it('tells the employee what a manager changed, and tells nobody about their own change', async () => {
      vi.mocked(checkInsideLocation).mockReturnValue(ok({} as never));
      vi.mocked(findResourceImpact).mockReturnValue(okAsync({ affected: [], isTruncated: false }));
      const save = vi.fn().mockReturnValue(okAsync({ ...employee, updatedAt: now }));
      const deps = {
        locations: { findById: vi.fn().mockReturnValue(okAsync(location)) },
        bookings: {} as any,
        team: { save },
        audit: { record: vi.fn() },
      };
      const change = (byManager: boolean) =>
        changeCalendar(deps as any, {
          scope,
          employee,
          next: nextCalendar,
          expected: expectedVersion,
          now,
          acknowledgeImpact: true,
          byManager,
          actorId: employee.actorId,
        });

      await change(true);
      await change(false);

      expect(save.mock.calls[0]?.[1].notice).toEqual(['qualifications']);
      expect(save.mock.calls[1]?.[1].notice).toEqual([]);
    });
  });
});
