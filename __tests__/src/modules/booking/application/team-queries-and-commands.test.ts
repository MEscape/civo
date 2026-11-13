// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { toActorId } from '@modules/auth/domain/models/ids';
import type { TeamDependencies } from '@modules/booking/application/booking-dependencies';
import { MoveTeamMember } from '@modules/booking/application/commands/move-team-member';
import { RemoveTeamMember } from '@modules/booking/application/commands/remove-team-member';
import { SaveOwnProfile } from '@modules/booking/application/commands/save-own-profile';
import { SetUpTeamMember } from '@modules/booking/application/commands/set-up-team-member';
import { UpdateTeamMember } from '@modules/booking/application/commands/update-team-member';
import { GetTeam } from '@modules/booking/application/queries/get-team';
import { GetTeamMember } from '@modules/booking/application/queries/get-team-member';
import { employeeAlreadySetUp } from '@modules/booking/domain/errors/booking-errors';
import { toBookableResourceId, toBookingLocationId } from '@modules/booking/domain/models/ids';
import type { StoredLocation } from '@modules/booking/domain/ports/location-admin.repository';
import type { StoredEmployee } from '@modules/booking/domain/ports/team.repository';

import { forbiddenError } from '@lib/errors';
import { okAsync, errAsync } from '@lib/result';

import { makeBooking, unitOf } from '../support/booking-fixtures';
import { TENANT } from '../support/location-fakes';
import { at, BERLIN } from '../support/time-fixtures';

describe('Team Queries and Commands Application Use Cases', () => {
  const managerActorId = toActorId('actor-manager-1');
  const employeeActorId = toActorId('actor-employee-1');
  const candidateActorId = toActorId('actor-candidate-2');
  const locationId = toBookingLocationId('loc-team-1');
  const employeeResourceId = toBookableResourceId('res-emp-1');
  const nowInstant = at('2027-01-10', '12:00');
  const version1 = at('2027-01-01', '09:00');

  const workingSchedule = {
    1: { ranges: [{ startMinute: 480, endMinute: 1080 }], breaks: [] },
    2: { ranges: [{ startMinute: 480, endMinute: 1080 }], breaks: [] },
    3: { ranges: [{ startMinute: 480, endMinute: 1080 }], breaks: [] },
    4: { ranges: [{ startMinute: 480, endMinute: 1080 }], breaks: [] },
    5: { ranges: [{ startMinute: 480, endMinute: 1080 }], breaks: [] },
    6: { ranges: [], breaks: [] },
    7: { ranges: [], breaks: [] },
  };

  const workday = {
    intervals: [{ start: '08:00', end: '17:00' }],
    breaks: [],
  };
  const dayOff = {
    intervals: [],
    breaks: [],
  };
  const weeklyInput = [workday, workday, workday, workday, workday, dayOff, dayOff];

  const location: StoredLocation = {
    id: locationId,
    name: 'Bürgeramt West',
    address: 'Westring 10',
    zone: BERLIN,
    isActive: true,
    openingHours: { weekly: workingSchedule, exceptions: [] },
    updatedAt: nowInstant,
  };

  const storedEmployee: StoredEmployee = {
    id: employeeResourceId,
    actorId: employeeActorId,
    name: 'Sabine Schmitt',
    locationId,
    skills: ['ausweise'],
    isActive: true,
    availability: { weekly: workingSchedule, exceptions: [] },
    coverage: [],
    updatedAt: version1,
  };

  const makeTeamDeps = (overrides: Partial<TeamDependencies> = {}): TeamDependencies => ({
    access: {
      authorizeWebsite: vi.fn().mockImplementation((perm) => {
        if (perm === 'booking.configure') {
          return okAsync({
            actor: { id: managerActorId, tenantId: TENANT, roles: ['manager'] },
            websiteId: TENANT,
          });
        }
        if (perm === 'booking.profile.own') {
          return okAsync({
            actor: { id: employeeActorId, tenantId: TENANT, roles: ['employee'] },
            websiteId: TENANT,
          });
        }
        return errAsync(forbiddenError('auth.permission_denied', 'Permission denied'));
      }),
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
    team: {
      listAt: vi.fn().mockReturnValue(okAsync({ members: [storedEmployee], isTruncated: false })),
      listVisiting: vi.fn().mockReturnValue(okAsync({ members: [], isTruncated: false })),
      listActorIds: vi
        .fn()
        .mockReturnValue(okAsync({ actorIds: [employeeActorId], isTruncated: false })),
      findById: vi.fn().mockReturnValue(okAsync(storedEmployee)),
      findOfActor: vi.fn().mockReturnValue(okAsync(storedEmployee)),
      create: vi
        .fn()
        .mockImplementation((_scope, newEmp, now) =>
          okAsync({ ...newEmp, id: toBookableResourceId('res-new-emp'), updatedAt: now }),
        ),
      save: vi.fn().mockImplementation((_scope, change) => okAsync(change.stored)),
    },
    directory: {
      listEmployees: vi.fn().mockReturnValue(
        okAsync({
          members: [
            { id: employeeActorId, name: 'Sabine Schmitt' },
            { id: candidateActorId, name: 'Michael Meyer' },
          ],
          isTruncated: false,
        }),
      ),
    },
    bookings: {
      list: vi.fn().mockReturnValue(okAsync([])),
      findById: vi.fn().mockReturnValue(okAsync(null)),
      save: vi.fn(),
    },
    audit: { record: vi.fn() },
    ...overrides,
  });

  describe('GetTeam and GetTeamMember', () => {
    it('returns team members and candidate employees without a calendar', async () => {
      const deps = makeTeamDeps();
      const query = new GetTeam(deps);
      const result = await query.execute({ websiteId: 'tenant-1', locationId: String(locationId) });
      expect(result.isOk()).toBe(true);
      const view = result._unsafeUnwrap();
      expect(view.members.length).toBe(1);
      expect(view.members[0]?.name).toBe('Sabine Schmitt');
      expect(view.candidates.length).toBe(1);
      expect(view.candidates[0]?.name).toBe('Michael Meyer');
    });

    it('returns team member view with qualifications and location context', async () => {
      const deps = makeTeamDeps();
      const query = new GetTeamMember(deps);
      const result = await query.execute({
        websiteId: 'tenant-1',
        employeeId: String(employeeResourceId),
      });
      expect(result.isOk()).toBe(true);
      const view = result._unsafeUnwrap();
      expect(view.name).toBe('Sabine Schmitt');
      expect(view.qualifications).toContain('ausweise');
    });
  });

  describe('SetUpTeamMember', () => {
    it('sets up a calendar for a member with employee role and records audit', async () => {
      const deps = makeTeamDeps();
      const cmd = new SetUpTeamMember(deps);
      const result = await cmd.execute({
        websiteId: 'tenant-1',
        locationId: String(locationId),
        actorId: String(candidateActorId),
      });
      expect(result.isOk()).toBe(true);
      expect(deps.team.create).toHaveBeenCalled();
      expect(deps.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'booking.team_member_set_up',
        }),
      );
    });

    it('refuses to set up a member who already has a calendar', async () => {
      const base = makeTeamDeps();
      const deps = makeTeamDeps({
        team: {
          ...base.team,
          create: vi.fn().mockReturnValue(errAsync(employeeAlreadySetUp())),
        },
      });
      const cmd = new SetUpTeamMember(deps);
      const result = await cmd.execute({
        websiteId: 'tenant-1',
        locationId: String(locationId),
        actorId: String(employeeActorId),
      });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('booking.employee_already_set_up');
    });
  });

  describe('UpdateTeamMember', () => {
    it('updates employee qualifications and schedule and records audit', async () => {
      const deps = makeTeamDeps();
      const cmd = new UpdateTeamMember(deps);
      const result = await cmd.execute({
        websiteId: 'tenant-1',
        employeeId: String(employeeResourceId),
        expectedVersion: new Date(version1).toISOString(),
        qualifications: ['ausweise', 'fuehrerschein'],
        coverage: [],
        acknowledgeImpact: false,
        openingHours: {
          weekly: weeklyInput,
          exceptions: [],
        },
      });
      expect(result.isOk()).toBe(true);
      // What the manager changed is told to the employee in a message, written with the save.
      expect(deps.team.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ notice: expect.arrayContaining(['qualifications']) }),
      );
      expect(deps.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'booking.team_member_updated',
        }),
      );
    });

    it('fails with stale error when expectedVersion does not match', async () => {
      const deps = makeTeamDeps();
      const cmd = new UpdateTeamMember(deps);
      const result = await cmd.execute({
        websiteId: 'tenant-1',
        employeeId: String(employeeResourceId),
        expectedVersion: new Date(version1 + 50000).toISOString(),
        qualifications: ['ausweise'],
        coverage: [],
        acknowledgeImpact: false,
        openingHours: {
          weekly: weeklyInput,
          exceptions: [],
        },
      });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('booking.resource_stale');
    });
  });

  describe('SaveOwnProfile', () => {
    it('allows employee to save their own profile, and tells nobody about it', async () => {
      const deps = makeTeamDeps();
      const cmd = new SaveOwnProfile(deps);
      const result = await cmd.execute({
        websiteId: 'tenant-1',
        expectedVersion: new Date(version1).toISOString(),
        acknowledgeImpact: false,
        openingHours: {
          weekly: weeklyInput,
          exceptions: [],
        },
      });
      expect(result.isOk()).toBe(true);
      // Their own change is no news to them: no message is written.
      expect(deps.team.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ notice: [] }),
      );
    });
  });

  describe('RemoveTeamMember and MoveTeamMember', () => {
    const version = () => new Date(version1).toISOString();
    const otherId = toBookingLocationId('loc-team-2');
    const other: StoredLocation = { ...location, id: otherId, name: 'Bürgeramt Ost' };
    /** A confirmed booking of the employee that has not begun, at their location. */
    const held = () => ({
      tenantId: TENANT,
      placement: {},
      booking: makeBooking({
        locationId,
        assignments: [unitOf(String(employeeResourceId))],
      }),
    });
    const withBooking = () =>
      makeTeamDeps({
        bookings: {
          list: vi.fn().mockReturnValue(okAsync([held()])),
          findById: vi.fn().mockReturnValue(okAsync(held())),
          save: vi.fn().mockImplementation((_scope, change) => okAsync(change.stored)),
        },
      });

    it('switches the calendar off, never deletes it, and records who did it', async () => {
      const deps = makeTeamDeps();

      const result = await new RemoveTeamMember(deps).execute({
        websiteId: 'tenant-1',
        employeeId: String(employeeResourceId),
        expectedVersion: version(),
        acknowledgeImpact: false,
      });

      expect(result._unsafeUnwrap()).toMatchObject({ releasedBookings: 0 });
      expect(deps.team.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          stored: expect.objectContaining({ isActive: false, coverage: [] }),
        }),
      );
      expect(deps.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'booking.team_member_removed', leftOpen: 0 }),
      );
    });

    it('is refused when somebody saved the calendar since it was read', async () => {
      const result = await new RemoveTeamMember(makeTeamDeps()).execute({
        websiteId: 'tenant-1',
        employeeId: String(employeeResourceId),
        expectedVersion: new Date(version1 + 100_000).toISOString(),
        acknowledgeImpact: false,
      });

      expect(result._unsafeUnwrapErr().code).toBe('booking.resource_stale');
    });

    it('asks to see the bookings first, then makes them open again and cancels none', async () => {
      const deps = withBooking();
      const input = {
        websiteId: 'tenant-1',
        employeeId: String(employeeResourceId),
        expectedVersion: version(),
      };

      const refused = await new RemoveTeamMember(deps).execute({
        ...input,
        acknowledgeImpact: false,
      });
      const removed = await new RemoveTeamMember(deps).execute({
        ...input,
        acknowledgeImpact: true,
      });

      expect(refused._unsafeUnwrapErr().code).toBe('booking.resource_impact_unacknowledged');
      expect(removed._unsafeUnwrap().releasedBookings).toBe(1);
      const saved = vi.mocked(deps.bookings.save).mock.calls[0]?.[1].stored.booking;
      expect(saved?.status).toBe('confirmed');
      expect(saved?.assignments[0]?.resourceId).toBeNull();
    });

    it('moves the member: the old calendar is off, a new one starts in the other team with the same qualifications', async () => {
      const deps = makeTeamDeps({
        locations: {
          findById: vi
            .fn()
            .mockImplementation((_scope, id) => okAsync(id === otherId ? other : location)),
          list: vi.fn().mockReturnValue(okAsync([location, other])),
        },
      });

      const moved = (
        await new MoveTeamMember(deps).execute({
          websiteId: 'tenant-1',
          employeeId: String(employeeResourceId),
          expectedVersion: version(),
          acknowledgeImpact: false,
          locationId: otherId,
        })
      )._unsafeUnwrap();

      expect(moved.location).toEqual({ id: otherId, name: 'Bürgeramt Ost' });
      expect(moved.qualifications).toEqual(['ausweise']);
      expect(deps.team.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          actorId: employeeActorId,
          locationId: otherId,
          isActive: true,
          notice: ['setup'],
        }),
        expect.anything(),
      );
      expect(deps.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'booking.team_member_moved', locationId: otherId }),
      );
    });

    it('does not move a member to the location they are already in', async () => {
      const result = await new MoveTeamMember(makeTeamDeps()).execute({
        websiteId: 'tenant-1',
        employeeId: String(employeeResourceId),
        expectedVersion: version(),
        acknowledgeImpact: false,
        locationId,
      });

      expect(result._unsafeUnwrapErr().code).toBe('booking.validation_failed');
    });
  });
});
