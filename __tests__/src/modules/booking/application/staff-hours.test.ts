import { describe, expect, it } from 'vitest';

import type { Role } from '@modules/auth/domain/models/role';
import { AcknowledgeManagerChange } from '@modules/booking/application/commands/acknowledge-manager-change';
import { SetStaffHours } from '@modules/booking/application/commands/set-staff-hours';
import { SetTeamHours } from '@modules/booking/application/commands/set-team-hours';
import { SetTeamMemberServices } from '@modules/booking/application/commands/set-team-member-services';
import { toAvailabilityPlanInput } from '@modules/booking/domain/models/availability-plan';
import { employeeHoursOf } from '@modules/booking/domain/models/booking-location';
import { toBookableResourceId } from '@modules/booking/domain/models/ids';
import { clipToFrame } from '@modules/booking/domain/scheduling/hours-containment';

import { actorWithRole } from '../support/fakes';
import {
  LOCATION_ID,
  SERVICE_ID,
  TENANT,
  WEBSITE,
  hours,
  makeLocation,
  makeResource,
  makeService,
  plan,
  weekdays,
} from '../support/fixtures';
import { createWorld } from '../support/world';

const as = (role: Role) => actorWithRole(TENANT, role);

// The location is open Monday to Friday, 08:00 to 18:00.
const MORNINGS = toAvailabilityPlanInput(weekdays('08:00', '12:00'));

const anna = (overrides = {}) =>
  makeResource('emp-1', { assignedActorId: 'actor-1', locationId: LOCATION_ID, ...overrides });

const stored = async (world: ReturnType<typeof createWorld>, id: string) =>
  (await world.resources.findById(toBookableResourceId(id), TENANT))._unsafeUnwrap();

describe('the plan cut to a frame', () => {
  it('keeps the parts inside, splits a stretch around a gap, and cuts breaks to what is left', () => {
    const frame = plan({
      1: {
        intervals: [
          { start: '08:00', end: '10:00' },
          { start: '14:00', end: '18:00' },
        ],
        breaks: [],
      },
    });
    const own = plan({
      1: {
        intervals: [{ start: '09:00', end: '16:00' }],
        breaks: [
          { start: '12:00', end: '12:30' },
          { start: '15:00', end: '15:30' },
        ],
      },
    });

    const clipped = toAvailabilityPlanInput(clipToFrame(own, frame));

    expect(clipped.weekly[0]).toEqual({
      intervals: [
        { start: '09:00', end: '10:00' },
        { start: '14:00', end: '16:00' },
      ],
      breaks: [{ start: '15:00', end: '15:30' }],
    });
  });
});

describe('the hours employees may work at a location', () => {
  it('are the opening hours until narrowed, and never reach beyond them', () => {
    const opening = weekdays('08:00', '18:00');

    expect(employeeHoursOf({ openingHours: opening, staffHours: null })).toBe(opening);
    expect(
      toAvailabilityPlanInput(
        employeeHoursOf({
          openingHours: weekdays('08:00', '12:00'),
          staffHours: weekdays('07:00', '16:00'),
        }),
      ).weekly[0],
    ).toEqual({ intervals: [{ start: '08:00', end: '12:00' }], breaks: [] });
  });
});

describe('setting when employees may work', () => {
  const set = (world: ReturnType<typeof createWorld>, staffHours: typeof MORNINGS | null) =>
    new SetStaffHours(world.admin).execute({ locationId: LOCATION_ID, staffHours });

  it('cuts the weeks of employees that reach beyond, and tells each of them', async () => {
    const world = createWorld({
      actor: as('admin'),
      resources: [anna({ availability: weekdays('09:00', '17:00') })],
    });

    (await set(world, MORNINGS))._unsafeUnwrap();

    const employee = await stored(world, 'emp-1');
    expect(toAvailabilityPlanInput(employee!.availability!).weekly[0]).toEqual({
      intervals: [{ start: '09:00', end: '12:00' }],
      breaks: [],
    });
    expect(employee?.managerChange?.kinds).toEqual(['hours']);
  });

  it('gives an employee who followed the location the narrower hours, and says so', async () => {
    const world = createWorld({ actor: as('admin'), resources: [anna()] });

    (await set(world, MORNINGS))._unsafeUnwrap();

    const employee = await stored(world, 'emp-1');
    expect(toAvailabilityPlanInput(employee!.availability!).weekly[0]).toEqual({
      intervals: [{ start: '08:00', end: '12:00' }],
      breaks: [],
    });
    expect(employee?.managerChange).not.toBeNull();
  });

  it('leaves alone, and does not notify, an employee whose week already fits', async () => {
    const world = createWorld({
      actor: as('admin'),
      resources: [anna({ availability: weekdays('09:00', '11:00') })],
    });

    (await set(world, MORNINGS))._unsafeUnwrap();

    const employee = await stored(world, 'emp-1');
    expect(toAvailabilityPlanInput(employee!.availability!).weekly[0]?.intervals).toEqual([
      { start: '09:00', end: '11:00' },
    ]);
    expect(employee?.managerChange).toBeNull();
  });

  it('refuses employees weeks beyond the narrowed hours from then on', async () => {
    const world = createWorld({ actor: as('admin'), resources: [anna()] });
    (await set(world, MORNINGS))._unsafeUnwrap();

    const refused = await new SetTeamHours(world.admin).execute({
      resourceIds: ['emp-1'],
      availability: toAvailabilityPlanInput(weekdays('09:00', '16:00')),
    });
    const allowed = await new SetTeamHours(world.admin).execute({
      resourceIds: ['emp-1'],
      availability: toAvailabilityPlanInput(weekdays('09:00', '11:00')),
    });

    expect(refused._unsafeUnwrapErr().kind).toBe('validation');
    expect(allowed.isOk()).toBe(true);
  });

  it('is lifted by null, which leaves what employees have as it is', async () => {
    const world = createWorld({ actor: as('admin'), resources: [anna()] });
    (await set(world, MORNINGS))._unsafeUnwrap();

    (await set(world, null))._unsafeUnwrap();

    expect(
      (await world.locations.findById(LOCATION_ID, TENANT))._unsafeUnwrap()?.staffHours,
    ).toBeNull();
    expect(
      toAvailabilityPlanInput((await stored(world, 'emp-1'))!.availability!).weekly[0]?.intervals,
    ).toEqual([{ start: '08:00', end: '12:00' }]);
  });

  it('is for those who manage the bookings', async () => {
    for (const role of ['viewer', 'employee'] as const) {
      const world = createWorld({ actor: as(role) });

      expect((await set(world, MORNINGS))._unsafeUnwrapErr().kind).toBe('forbidden');
    }
  });

  it('follows the opening hours when they are narrowed later, so the two never disagree', async () => {
    const world = createWorld({
      actor: as('admin'),
      location: makeLocation({ staffHours: weekdays('08:00', '18:00') }),
    });
    const location = (await world.locations.findById(LOCATION_ID, TENANT))._unsafeUnwrap()!;

    const narrowed = employeeHoursOf({
      ...location,
      openingHours: plan({ 1: hours('09:00', '10:00') }),
    });

    expect(toAvailabilityPlanInput(narrowed).weekly[0]?.intervals).toEqual([
      { start: '09:00', end: '10:00' },
    ]);
  });
});

describe('what a manager changes on an employee, and what the employee is told', () => {
  it('tells the employee when a manager sets their hours, once for several changes', async () => {
    const world = createWorld({ actor: as('admin'), resources: [anna()] });
    const set = (availability: typeof MORNINGS) =>
      new SetTeamHours(world.admin).execute({ resourceIds: ['emp-1'], availability });

    (await set(MORNINGS))._unsafeUnwrap();
    const first = (await stored(world, 'emp-1'))?.managerChange;
    (await set(toAvailabilityPlanInput(weekdays('09:00', '11:00'))))._unsafeUnwrap();

    expect(first?.kinds).toEqual(['hours']);
    expect((await stored(world, 'emp-1'))?.managerChange?.kinds).toEqual(['hours']);
  });

  it('does not tell the employee when the hours they are given are the hours they have', async () => {
    const world = createWorld({
      actor: as('admin'),
      resources: [anna({ availability: weekdays('08:00', '12:00') })],
    });

    (
      await new SetTeamHours(world.admin).execute({
        resourceIds: ['emp-1'],
        availability: MORNINGS,
      })
    )._unsafeUnwrap();

    expect((await stored(world, 'emp-1'))?.managerChange).toBeNull();
  });

  it('puts an employee on services of their location, and tells them', async () => {
    const world = createWorld({ actor: as('admin'), resources: [anna({ skills: [] })] });
    const other = makeService({ id: 'svc-other' as never, name: 'Other' });
    world.services.seed(other);

    const view = (
      await new SetTeamMemberServices(world.admin).execute({
        resourceId: 'emp-1',
        offeredServiceIds: [SERVICE_ID, 'svc-other'],
      })
    )._unsafeUnwrap();

    expect(view.skills).toEqual(expect.arrayContaining([`svc-${SERVICE_ID}`, 'svc-svc-other']));
    expect(view.managerChange?.kinds).toEqual(['services']);
  });

  it('refuses a service that is not offered where the employee works', async () => {
    const world = createWorld({ actor: as('admin'), resources: [anna()] });
    world.services.seed(makeService({ id: 'svc-elsewhere' as never, locationIds: [] }));

    const result = await new SetTeamMemberServices(world.admin).execute({
      resourceId: 'emp-1',
      offeredServiceIds: ['svc-elsewhere'],
    });

    expect(result._unsafeUnwrapErr().kind).toBe('validation');
  });

  it('is for those who manage, and only about employees', async () => {
    const employee = createWorld({ actor: as('employee'), resources: [anna()] });
    const room = createWorld({
      actor: as('admin'),
      resources: [makeResource('room-1', { type: 'room', locationId: LOCATION_ID })],
    });

    expect(
      (
        await new SetTeamMemberServices(employee.admin).execute({
          resourceId: 'emp-1',
          offeredServiceIds: [],
        })
      )._unsafeUnwrapErr().kind,
    ).toBe('forbidden');
    expect(
      (
        await new SetTeamMemberServices(room.admin).execute({
          resourceId: 'room-1',
          offeredServiceIds: [],
        })
      )._unsafeUnwrapErr().kind,
    ).toBe('not_found');
  });

  it("clears only the signed-in employee's own notice", async () => {
    const own = makeResource('emp-own', {
      assignedActorId: 'actor-employee',
      locationId: LOCATION_ID,
      managerChange: { at: new Date('2027-01-04T06:00:00Z'), kinds: ['hours'] },
    });
    const colleague = makeResource('emp-colleague', {
      assignedActorId: 'someone-else',
      locationId: LOCATION_ID,
      managerChange: { at: new Date('2027-01-04T06:00:00Z'), kinds: ['services'] },
    });
    const world = createWorld({ actor: as('employee'), resources: [own, colleague] });

    (await new AcknowledgeManagerChange(world.admin).execute(WEBSITE))._unsafeUnwrap();

    expect((await stored(world, 'emp-own'))?.managerChange).toBeNull();
    expect((await stored(world, 'emp-colleague'))?.managerChange).not.toBeNull();
  });
});
