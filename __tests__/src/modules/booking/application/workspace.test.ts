import { describe, expect, it } from 'vitest';

import type { Role } from '@modules/auth/domain/models/role';
import { OfferServiceAtLocation } from '@modules/booking/application/commands/offer-service-at-location';
import { SetTeamHours } from '@modules/booking/application/commands/set-team-hours';
import { GetLocationWorkspace } from '@modules/booking/application/queries/get-location-workspace';
import { GetSetupOverview } from '@modules/booking/application/queries/get-setup-overview';
import { GetTeam } from '@modules/booking/application/queries/get-team';
import { toBookableResourceId, toBookingLocationId } from '@modules/booking/domain/models/ids';

import { OTHER_TENANT, actorWithRole } from '../support/fakes';
import {
  LOCATION_ID,
  SERVICE_ID,
  TENANT,
  WEBSITE,
  makeLocation,
  makeResource,
  makeService,
  plan,
  hours,
} from '../support/fixtures';
import { createWorld } from '../support/world';

const ANNEX_ID = toBookingLocationId('location-2');
const as = (role: Role) => actorWithRole(TENANT, role);

const DAY = { intervals: [{ start: '09:00', end: '12:00' }], breaks: [] };
const CLOSED = { intervals: [], breaks: [] };
const WEEK = { weekly: [DAY, DAY, DAY, DAY, DAY, CLOSED, CLOSED], exceptions: [] };

function withAnnex(role: Role, resources = [makeResource('emp-1')]) {
  const world = createWorld({ actor: as(role), resources });
  world.locations.seed(makeLocation({ id: ANNEX_ID, name: 'Annex', openingHours: plan({}) }));
  return world;
}

describe('the setup overview', () => {
  it('counts what each location holds, without employees, and says which has no hours', async () => {
    const world = withAnnex('viewer', [
      makeResource('emp-1'),
      makeResource('room-here', { type: 'room', locationId: LOCATION_ID }),
      makeResource('room-everywhere', { type: 'room', locationId: null }),
    ]);

    const overview = (await new GetSetupOverview(world.admin).execute(WEBSITE))._unsafeUnwrap();
    const byName = Object.fromEntries(overview.locations.map((entry) => [entry.name, entry]));

    expect(byName['Town hall']).toMatchObject({ isOpen: true, serviceCount: 1, resourceCount: 2 });
    // The annex has no hours, offers nothing, and only the room that travels.
    expect(byName['Annex']).toMatchObject({ isOpen: false, serviceCount: 0, resourceCount: 1 });
  });

  it('is for those who may read bookings, and no one else', async () => {
    const world = createWorld({ actor: as('employee') });

    expect((await new GetSetupOverview(world.admin).execute(WEBSITE))._unsafeUnwrapErr().kind).toBe(
      'forbidden',
    );
  });
});

describe('the workspace of a location', () => {
  it('gives the place, what is offered there with whether it can work, the rooms and what could be added', async () => {
    const world = withAnnex('viewer', [
      makeResource('emp-1'),
      makeResource('room-1', { type: 'room', locationId: LOCATION_ID }),
    ]);
    world.services.seed(
      makeService({
        id: 'svc-annex' as never,
        name: 'Annex only',
        locationIds: [ANNEX_ID],
        requirements: [{ resourceType: 'room', skills: [], count: 1, resourceIds: null }],
      }),
    );

    const workspace = (
      await new GetLocationWorkspace(world.admin).execute(LOCATION_ID)
    )._unsafeUnwrap();

    expect(workspace.location.name).toBe('Town hall');
    expect(workspace.services.map((entry) => [entry.service.name, entry.readiness])).toEqual([
      ['Passport application', 'ready'],
    ]);
    expect(workspace.resources.map((resource) => resource.id)).toEqual(['room-1']);
    expect(workspace.otherServices.map((service) => service.name)).toEqual(['Annex only']);
  });

  it('judges a service for this place alone: a room elsewhere does not make it ready here', async () => {
    const world = withAnnex('viewer', [
      makeResource('annex-room', { type: 'room', locationId: ANNEX_ID }),
    ]);
    world.services.seed(
      makeService({
        id: 'svc-room' as never,
        name: 'Room hire',
        locationIds: [LOCATION_ID, ANNEX_ID],
        requirements: [{ resourceType: 'room', skills: [], count: 1, resourceIds: null }],
      }),
    );

    const here = (await new GetLocationWorkspace(world.admin).execute(LOCATION_ID))._unsafeUnwrap();
    const there = (await new GetLocationWorkspace(world.admin).execute(ANNEX_ID))._unsafeUnwrap();

    const readiness = (workspace: typeof here) =>
      workspace.services.find((entry) => entry.service.name === 'Room hire')?.readiness;
    expect(readiness(here)).toBe('blocked');
    expect(readiness(there)).toBe('ready');
  });

  it('does not show a location of another tenant, nor tell that it exists', async () => {
    const world = createWorld({ actor: actorWithRole(OTHER_TENANT, 'admin') });

    expect(
      (await new GetLocationWorkspace(world.admin).execute(LOCATION_ID))._unsafeUnwrapErr().kind,
    ).toBe('not_found');
  });
});

describe('the team', () => {
  it('lists the employees with their hours and what they offer, next to the locations', async () => {
    const world = createWorld({
      actor: as('editor'),
      resources: [
        makeResource('emp-1', {
          assignedActorId: 'actor-1',
          availability: plan({ 1: hours('09:00', '12:00') }),
        }),
        makeResource('room-1', { type: 'room' }),
      ],
    });

    const team = (await new GetTeam(world.admin).execute(WEBSITE))._unsafeUnwrap();

    expect(team.members.map((member) => member.id)).toEqual(['emp-1']);
    expect(team.members[0]).toMatchObject({ offeredServiceIds: [SERVICE_ID] });
    expect(team.members[0]?.availability).not.toBeNull();
    expect(team.locations.map((location) => location.name)).toEqual(['Town hall']);
  });

  it('is for those who manage bookings: a viewer may not read it', async () => {
    const world = createWorld({ actor: as('viewer') });

    expect((await new GetTeam(world.admin).execute(WEBSITE))._unsafeUnwrapErr().kind).toBe(
      'forbidden',
    );
  });
});

describe('setting the working hours of employees', () => {
  const employees = () => [
    makeResource('emp-1', { assignedActorId: 'actor-1', name: 'Anna', locationId: LOCATION_ID }),
    makeResource('emp-2', { assignedActorId: 'actor-2', name: 'Ben', locationId: LOCATION_ID }),
  ];
  const stored = async (world: ReturnType<typeof createWorld>, id: string) =>
    (await world.resources.findById(toBookableResourceId(id), TENANT))._unsafeUnwrap();

  it('sets one employee, and changes nothing else about them', async () => {
    const world = createWorld({ actor: as('admin'), resources: employees() });

    await new SetTeamHours(world.admin).execute({ resourceIds: ['emp-1'], availability: WEEK });

    const anna = await stored(world, 'emp-1');
    expect(anna?.availability).not.toBeNull();
    expect(anna).toMatchObject({ name: 'Anna', assignedActorId: 'actor-1' });
    expect(anna?.skills).toContain(`svc-${SERVICE_ID}`);
    expect((await stored(world, 'emp-2'))?.availability).toBeNull();
    expect(world.audit.types()).toEqual(['booking.resource_updated']);
  });

  it('sets the same hours for everyone in one step, and can give them back to the location', async () => {
    const world = createWorld({ actor: as('admin'), resources: employees() });
    const set = new SetTeamHours(world.admin);

    (await set.execute({ resourceIds: ['emp-1', 'emp-2'], availability: WEEK }))._unsafeUnwrap();
    expect((await stored(world, 'emp-2'))?.availability).not.toBeNull();

    (await set.execute({ resourceIds: ['emp-1', 'emp-2'], availability: null }))._unsafeUnwrap();
    expect((await stored(world, 'emp-1'))?.availability).toBeNull();
    expect((await stored(world, 'emp-2'))?.availability).toBeNull();
  });

  it('changes nobody when one entry is wrong', async () => {
    const world = createWorld({ actor: as('admin'), resources: employees() });

    const unknown = await new SetTeamHours(world.admin).execute({
      resourceIds: ['emp-1', 'ghost'],
      availability: WEEK,
    });
    const overlapping = await new SetTeamHours(world.admin).execute({
      resourceIds: ['emp-1', 'emp-2'],
      availability: {
        weekly: Array.from({ length: 7 }, () => ({
          intervals: [
            { start: '09:00', end: '12:00' },
            { start: '11:00', end: '13:00' },
          ],
          breaks: [],
        })),
        exceptions: [],
      },
    });

    expect(unknown.isErr()).toBe(true);
    expect(overlapping._unsafeUnwrapErr().kind).toBe('validation');
    expect((await stored(world, 'emp-1'))?.availability).toBeNull();
    expect((await stored(world, 'emp-2'))?.availability).toBeNull();
  });

  it('treats a room as not found: only an employee has working hours to set', async () => {
    const world = createWorld({
      actor: as('admin'),
      resources: [makeResource('room-1', { type: 'room' })],
    });

    const result = await new SetTeamHours(world.admin).execute({
      resourceIds: ['room-1'],
      availability: WEEK,
    });

    expect(result._unsafeUnwrapErr().kind).toBe('not_found');
  });

  it('refuses nobody and refuses a crowd', async () => {
    const world = createWorld({ actor: as('admin'), resources: employees() });
    const set = new SetTeamHours(world.admin);

    expect(
      (await set.execute({ resourceIds: [], availability: WEEK }))._unsafeUnwrapErr().kind,
    ).toBe('validation');
    const crowd = Array.from({ length: 101 }, (_, index) => `emp-${index}`);
    expect(
      (await set.execute({ resourceIds: crowd, availability: WEEK }))._unsafeUnwrapErr().kind,
    ).toBe('validation');
  });

  it('answers a person without the permission before it looks at anything', async () => {
    const world = createWorld({ actor: as('viewer'), resources: employees() });

    const result = await new SetTeamHours(world.admin).execute({
      resourceIds: ['ghost'],
      availability: WEEK,
    });

    expect(result._unsafeUnwrapErr().kind).toBe('forbidden');
  });

  it("never reaches another tenant's employee", async () => {
    const world = createWorld({
      actor: actorWithRole(OTHER_TENANT, 'admin'),
      resources: employees(),
    });

    const result = await new SetTeamHours(world.admin).execute({
      resourceIds: ['emp-1'],
      availability: WEEK,
    });

    expect(result._unsafeUnwrapErr().kind).toBe('not_found');
    expect((await stored(world, 'emp-1'))?.availability).toBeNull();
  });
});

describe('offering a service at another location', () => {
  const offer = (world: ReturnType<typeof createWorld>, locationId: string, isOffered: boolean) =>
    new OfferServiceAtLocation(world.admin).execute({
      serviceId: SERVICE_ID,
      locationId,
      isOffered,
    });

  it('adds a location to the service and keeps everything else of it', async () => {
    const world = withAnnex('admin');

    const view = (await offer(world, ANNEX_ID, true))._unsafeUnwrap();

    expect(view.locationIds).toEqual([LOCATION_ID, ANNEX_ID]);
    expect(view.name).toBe('Passport application');
    expect(view.durationMinutes).toBe(30);
    expect(world.audit.types()).toEqual(['booking.service_updated']);
  });

  it('is idempotent: offering where it is already offered changes nothing', async () => {
    const world = withAnnex('admin');

    const view = (await offer(world, LOCATION_ID, true))._unsafeUnwrap();

    expect(view.locationIds).toEqual([LOCATION_ID]);
  });

  it('stops offering it somewhere, but never at the last location', async () => {
    const world = withAnnex('admin');
    (await offer(world, ANNEX_ID, true))._unsafeUnwrap();

    const removed = (await offer(world, LOCATION_ID, false))._unsafeUnwrap();
    const last = await offer(world, ANNEX_ID, false);

    expect(removed.locationIds).toEqual([ANNEX_ID]);
    expect(last._unsafeUnwrapErr().kind).toBe('validation');
  });

  it('refuses a location that does not exist', async () => {
    const world = createWorld({ actor: as('admin') });

    expect((await offer(world, 'nowhere', true))._unsafeUnwrapErr().kind).toBe('validation');
  });

  it('is for those who configure, never an employee or a viewer', async () => {
    for (const role of ['viewer', 'employee'] as const) {
      const world = withAnnex(role);

      expect((await offer(world, ANNEX_ID, true))._unsafeUnwrapErr().kind).toBe('forbidden');
    }
  });
});
