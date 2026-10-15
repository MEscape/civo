import { describe, expect, it } from 'vitest';

import type { Role } from '@modules/auth/domain/models/role';
import { DeleteBookableResource } from '@modules/booking/application/commands/delete-bookable-resource';
import { DeleteBookableService } from '@modules/booking/application/commands/delete-bookable-service';
import { DeleteBookingLocation } from '@modules/booking/application/commands/delete-booking-location';
import { BOOKING_ERROR_CODES } from '@modules/booking/domain/errors/booking-errors';
import { toBookingLocationId } from '@modules/booking/domain/models/ids';

import { OTHER_TENANT, actorWithRole } from '../support/fakes';
import {
  LOCATION_ID,
  SERVICE_ID,
  TENANT,
  at,
  makeBooking,
  makeLocation,
  makeResource,
  makeService,
} from '../support/fixtures';
import { createWorld } from '../support/world';

const as = (role: Role) => actorWithRole(TENANT, role);
const ANNEX = toBookingLocationId('location-2');
const PAST = at('2026-12-01', '10:00');

const codeOf = (result: { isErr(): boolean; _unsafeUnwrapErr(): { code: string } }) =>
  result._unsafeUnwrapErr().code;

describe('deleting a service', () => {
  it('removes one nobody has booked', async () => {
    const world = createWorld({ actor: as('admin') });

    const result = await new DeleteBookableService(world.admin).execute(SERVICE_ID);

    expect(result.isOk()).toBe(true);
    expect((await world.services.findById(SERVICE_ID, TENANT))._unsafeUnwrap()).toBeNull();
    expect(world.audit.types()).toContain('booking.service_deleted');
  });

  it('keeps one that has bookings, say why, and change nothing', async () => {
    const world = createWorld({ actor: as('admin') });
    world.bookings.seed(
      makeBooking({ id: 'b-1', start: PAST, resources: [], status: 'completed' }),
    );

    const result = await new DeleteBookableService(world.admin).execute(SERVICE_ID);

    expect(codeOf(result)).toBe(BOOKING_ERROR_CODES.hasBookings);
    expect((await world.services.findById(SERVICE_ID, TENANT))._unsafeUnwrap()).not.toBeNull();
  });

  it('is for those who may configure, and for nobody else', async () => {
    const world = createWorld({ actor: as('viewer') });

    expect((await new DeleteBookableService(world.admin).execute(SERVICE_ID)).isErr()).toBe(true);
    expect((await world.services.findById(SERVICE_ID, TENANT))._unsafeUnwrap()).not.toBeNull();
  });

  it("does not exist for another tenant's administrator", async () => {
    const world = createWorld({ actor: actorWithRole(OTHER_TENANT, 'admin') });

    const result = await new DeleteBookableService(world.admin).execute(SERVICE_ID);

    expect(result._unsafeUnwrapErr().kind).toBe('not_found');
  });
});

describe('deleting a resource', () => {
  const ROOM = makeResource('room-1', { type: 'room', locationId: LOCATION_ID });

  it('removes a room nobody has booked', async () => {
    const world = createWorld({ actor: as('admin'), resources: [ROOM] });

    expect((await new DeleteBookableResource(world.admin).execute('room-1')).isOk()).toBe(true);
    expect((await world.resources.findById(ROOM.id, TENANT))._unsafeUnwrap()).toBeNull();
  });

  it('keeps a room a service asks for by name', async () => {
    const world = createWorld({
      actor: as('admin'),
      resources: [ROOM],
      service: makeService({
        requirements: [{ resourceType: 'room', skills: [], count: 1, resourceIds: [ROOM.id] }],
      }),
    });

    const result = await new DeleteBookableResource(world.admin).execute('room-1');

    expect(codeOf(result)).toBe(BOOKING_ERROR_CODES.resourceInUse);
  });

  it('keeps a room that has been booked', async () => {
    const world = createWorld({ actor: as('admin'), resources: [ROOM] });
    world.bookings.seed(
      makeBooking({ id: 'b-1', start: PAST, resources: ['room-1'], status: 'cancelled' }),
    );

    const result = await new DeleteBookableResource(world.admin).execute('room-1');

    expect(codeOf(result)).toBe(BOOKING_ERROR_CODES.hasBookings);
  });

  it("never removes an employee's own calendar from here", async () => {
    const world = createWorld({
      actor: as('admin'),
      resources: [makeResource('emp-1', { assignedActorId: 'actor-1' })],
    });

    const result = await new DeleteBookableResource(world.admin).execute('emp-1');

    expect(result._unsafeUnwrapErr().kind).toBe('not_found');
  });
});

describe('deleting a location', () => {
  function withAnnex() {
    const world = createWorld({ actor: as('admin'), resources: [] });
    world.locations.seed(makeLocation({ id: ANNEX, name: 'Annex' }));
    return world;
  }

  it('removes an empty location nobody has booked', async () => {
    const world = withAnnex();
    world.services.seed(
      makeService({ id: 'svc-2' as never, name: 'Elsewhere', locationIds: [LOCATION_ID, ANNEX] }),
    );

    const result = await new DeleteBookingLocation(world.admin).execute(ANNEX);

    expect(result.isOk()).toBe(true);
    expect((await world.locations.findById(ANNEX, TENANT))._unsafeUnwrap()).toBeNull();
  });

  it('stops offering the shared services there, and nowhere else', async () => {
    const world = withAnnex();
    world.services.seed(
      makeService({ id: 'svc-2' as never, name: 'Shared', locationIds: [LOCATION_ID, ANNEX] }),
    );

    await new DeleteBookingLocation(world.admin).execute(ANNEX);

    const shared = (await world.services.findById('svc-2', TENANT))._unsafeUnwrap();
    expect(shared?.locationIds).toEqual([LOCATION_ID]);
  });

  it('refuses while a service is offered only there, and changes nothing', async () => {
    const world = withAnnex();
    world.services.seed(
      makeService({ id: 'svc-2' as never, name: 'Only here', locationIds: [ANNEX] }),
    );

    const result = await new DeleteBookingLocation(world.admin).execute(ANNEX);

    expect(codeOf(result)).toBe(BOOKING_ERROR_CODES.serviceOnlyHere);
    expect((await world.locations.findById(ANNEX, TENANT))._unsafeUnwrap()).not.toBeNull();
  });

  it('refuses while rooms or people are placed there', async () => {
    const world = createWorld({
      actor: as('admin'),
      resources: [makeResource('emp-1', { locationId: LOCATION_ID })],
    });

    const result = await new DeleteBookingLocation(world.admin).execute(LOCATION_ID);

    expect(codeOf(result)).toBe(BOOKING_ERROR_CODES.locationNotEmpty);
  });

  it('refuses a location that has been booked, however long ago', async () => {
    const world = withAnnex();
    world.bookings.seed(
      makeBooking({
        id: 'b-1',
        start: PAST,
        resources: [],
        location: makeLocation({ id: ANNEX }),
        status: 'completed',
      }),
    );

    const result = await new DeleteBookingLocation(world.admin).execute(ANNEX);

    expect(codeOf(result)).toBe(BOOKING_ERROR_CODES.hasBookings);
  });

  it('is not possible for someone who may only look', async () => {
    const world = createWorld({ actor: as('viewer') });

    expect((await new DeleteBookingLocation(world.admin).execute(LOCATION_ID)).isErr()).toBe(true);
  });
});
