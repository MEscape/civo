/**
 * Integration test, against a real Postgres, of storing and reading bookings and the setup they
 * refer to: what is stored comes back the same, what is invalid is refused and leaves nothing
 * behind, and another website sees nothing. Needs the database of `DATABASE_URL` with the migrations
 * applied: `npm run test:integration`.
 */
import { describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth';
import { toActorId } from '@modules/auth/domain/models/ids';
import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';
import {
  toBookableResourceId,
  toBookableServiceId,
  toBookingId,
  toBookingLocationId,
} from '@modules/booking/domain/models/ids';

import { db } from '@lib/db';

import { unitOf } from '../support/booking-fixtures';
import { stored } from '../support/persistence-fixtures';
import {
  NOW,
  bookings,
  locations,
  resources,
  services,
  useWorld,
} from '../support/persistence-suite';
import { unwrap } from '../support/time-fixtures';

describe('storing and reading bookings (real Postgres)', () => {
  const suite = useWorld();

  describe('a booking and its units', () => {
    it('reads back what it stored, units and customer included', async () => {
      const { world } = suite;
      const original = stored(world, {
        id: 'roundtrip',
        time: '09:00',
        units: [world.ids.anna, world.ids.room],
        overrides: { customer: { firstName: 'Julia', email: 'Julia@Example.org' } },
      });

      const created = unwrap(await bookings.create(world.scope, original, NOW));
      const found = unwrap(await bookings.findById(world.scope, original.booking.id));

      expect(created.booking.createdAt).toBe(NOW);
      expect(found).toEqual({
        // The row names its own tenant, which an authorization check can compare with the caller's.
        tenantId: world.scope.tenantId,
        booking: { ...original.booking, createdAt: NOW, updatedAt: NOW },
        placement: original.placement,
      });
    });

    it('finds a booking by the reference the visitor quotes', async () => {
      const booking = await suite.store({
        id: 'by-ref',
        time: '09:30',
        units: [suite.world.ids.ben],
      });

      const found = unwrap(
        await bookings.findByReference(suite.world.scope, booking.placement.reference),
      );

      expect(found?.booking.id).toBe(booking.booking.id);
    });

    it('keeps an employee unit that nobody serves yet', async () => {
      const open = await suite.store({ id: 'open', time: '11:00', units: [null] });

      const found = unwrap(await bookings.findById(suite.world.scope, open.booking.id));

      // The open unit still knows what its employee will be held for.
      expect(found?.booking.assignments).toEqual([
        {
          requirementIndex: 0,
          resourceType: 'employee',
          resourceId: null,
          occupied: open.booking.occupied,
        },
      ]);
    });

    it('answers null for a booking that does not exist', async () => {
      const found = unwrap(await bookings.findById(suite.world.scope, toBookingId('missing')));

      expect(found).toBeNull();
    });

    it('refuses a reference that is taken, and stores nothing of the second booking', async () => {
      const { world } = suite;
      const first = await suite.store({ id: 'ref-1', time: '13:00', units: [world.ids.anna] });
      const second = stored(world, {
        id: 'ref-2',
        time: '14:00',
        units: [world.ids.anna],
        reference: first.placement.reference,
      });

      const result = await bookings.create(world.scope, second, NOW);

      expect(result._unsafeUnwrapErr()).toMatchObject({ code: CODES.referenceTaken });
      expect(unwrap(await bookings.findById(world.scope, second.booking.id))).toBeNull();
    });

    it('refuses an id that is taken', async () => {
      const { world } = suite;
      const first = await suite.store({ id: 'id-1', time: '15:00', units: [world.ids.anna] });

      const again = await bookings.create(
        world.scope,
        stored(world, { id: 'id-1', time: '16:00', units: [world.ids.ben] }),
        NOW,
      );

      expect(again._unsafeUnwrapErr()).toMatchObject({ code: CODES.referenceTaken });
      expect(unwrap(await bookings.findById(world.scope, first.booking.id))?.booking.start).toBe(
        first.booking.start,
      );
    });
  });

  describe('what the database and the rules refuse', () => {
    it('refuses a unit that names a resource of another website, and stores nothing', async () => {
      const { world } = suite;
      const crossing = stored(world, { id: 'crossing', time: '08:00', units: [world.ids.foreign] });

      const result = await bookings.create(world.scope, crossing, NOW);

      expect(result._unsafeUnwrapErr()).toMatchObject({ kind: 'infrastructure' });
      expect(unwrap(await bookings.findById(world.scope, crossing.booking.id))).toBeNull();
    });

    it('refuses a booking of a service or a location of another website', async () => {
      const { world } = suite;
      const base = stored(world, { id: 'foreign-ref', time: '08:30', units: [world.ids.anna] });

      const service = await bookings.create(
        world.scope,
        {
          ...base,
          booking: { ...base.booking, serviceId: toBookableServiceId(world.ids.foreign) },
        },
        NOW,
      );
      const location = await bookings.create(
        world.scope,
        {
          ...base,
          booking: { ...base.booking, locationId: toBookingLocationId(world.ids.foreign) },
        },
        NOW,
      );

      expect(service._unsafeUnwrapErr()).toMatchObject({ kind: 'infrastructure' });
      expect(location._unsafeUnwrapErr()).toMatchObject({ kind: 'infrastructure' });
      expect(unwrap(await bookings.findById(world.scope, base.booking.id))).toBeNull();
    });

    it('refuses a booking that breaks its own invariants before it reaches the database', async () => {
      const { world } = suite;
      const twice = stored(world, {
        id: 'twice',
        time: '08:30',
        units: [world.ids.anna, world.ids.anna],
      });
      const cancelledWithoutWho = stored(world, {
        id: 'no-who',
        time: '09:00',
        units: [world.ids.anna],
        overrides: { status: 'cancelled', holdExpiresAt: null },
      });

      for (const broken of [twice, cancelledWithoutWho]) {
        const result = await bookings.create(world.scope, broken, NOW);

        expect(result._unsafeUnwrapErr()).toMatchObject({
          kind: 'infrastructure',
          code: CODES.persistenceFailed,
        });
        expect(unwrap(await bookings.findById(world.scope, broken.booking.id))).toBeNull();
      }
    });

    it('refuses a unit whose type is not the type of the resource it names', async () => {
      const { world } = suite;
      const base = stored(world, { id: 'wrong-type', time: '10:30', units: [world.ids.room] });
      const roomAsEmployee = {
        ...base,
        booking: {
          ...base.booking,
          assignments: [unitOf(world.ids.room, { resourceType: 'employee' })],
        },
      };

      const result = await bookings.create(world.scope, roomAsEmployee, NOW);

      expect(result._unsafeUnwrapErr()).toMatchObject({ kind: 'infrastructure' });
      expect(unwrap(await bookings.findById(world.scope, base.booking.id))).toBeNull();
    });

    it('refuses a group larger than the session has places', async () => {
      const { world } = suite;
      const tooMany = stored(world, {
        id: 'too-many',
        time: '10:00',
        units: [world.ids.anna],
        participants: 3,
        sessionCapacity: 2,
      });

      const result = await bookings.create(world.scope, tooMany, NOW);

      expect(result._unsafeUnwrapErr()).toMatchObject({ kind: 'infrastructure' });
    });

    it('does not read a stored booking that breaks its invariants', async () => {
      const { world } = suite;
      const booked = await suite.store({ id: 'damaged', time: '17:00', units: [world.ids.anna] });
      // Damage it behind the repository's back, the way an old release or a hand edit could.
      await db.orm.public.Booking.where({
        id: booked.booking.id,
        websiteId: world.scope.websiteId,
      }).updateAndCount({
        cancelledBy: 'staff',
      });

      const result = await bookings.findById(world.scope, booked.booking.id);

      expect(result._unsafeUnwrapErr()).toMatchObject({ code: CODES.persistenceFailed });
    });
  });

  describe('the setup a booking refers to', () => {
    it('reads the service as the rules use it', async () => {
      const { world } = suite;

      const service = await suite.service();

      expect(service).toMatchObject({
        id: world.serviceId,
        isActive: true,
        assignmentMode: 'automatic',
        rules: { durationMinutes: 30, stepMinutes: 30 },
        requirements: [{ resourceType: 'employee', skills: ['ausweise'], count: 1 }],
        cancellation: { isAllowed: true, deadlineMinutes: 60 },
      });
    });

    it('reads the zone of a location', async () => {
      const { world } = suite;

      const location = unwrap(await locations.findById(world.scope, world.locationId));

      expect(location).toMatchObject({
        id: world.locationId,
        zone: 'Europe/Berlin',
        isActive: true,
      });
    });

    it('reads resources one by one, by the member whose calendar they are, and as a list', async () => {
      const { world } = suite;

      const byId = unwrap(
        await resources.findById(world.scope, toBookableResourceId(world.ids.room)),
      );
      const ofMember = unwrap(
        await resources.findEmployeeOf(world.scope, toActorId(world.actors.anna)),
      );
      const nobody = unwrap(await resources.findEmployeeOf(world.scope, toActorId('nobody')));
      const employees = unwrap(
        await resources.list(world.scope, { types: ['employee'], limit: 10 }),
      );
      const atLocation = unwrap(
        await resources.list(world.scope, { servingLocationId: world.locationId, limit: 2 }),
      );

      expect(byId).toMatchObject({ type: 'room', skills: [] });
      expect(ofMember).toMatchObject({
        id: world.ids.anna,
        type: 'employee',
        skills: ['ausweise'],
      });
      expect(nobody).toBeNull();
      expect(employees.map((resource) => resource.id)).toEqual(
        [world.ids.anna, world.ids.ben].sort(),
      );
      expect(atLocation).toHaveLength(2);
    });
  });

  describe('another website', () => {
    it('finds none of the bookings or the setup of this one', async () => {
      const { world } = suite;
      const mine = await suite.store({ id: 'mine', time: '12:00', units: [world.ids.anna] });

      const results = await Promise.all([
        bookings.findById(world.otherScope, mine.booking.id),
        bookings.findByReference(world.otherScope, mine.placement.reference),
        services.findById(world.otherScope, world.serviceId),
        locations.findById(world.otherScope, world.locationId),
        resources.findById(world.otherScope, toBookableResourceId(world.ids.anna)),
        resources.findEmployeeOf(world.otherScope, toActorId(world.actors.anna)),
      ]);

      expect(results.map((result) => result._unsafeUnwrap())).toEqual([
        null,
        null,
        null,
        null,
        null,
        null,
      ]);
      expect(
        unwrap(await resources.list(world.otherScope, { limit: 10 })).map(
          (resource) => resource.id,
        ),
      ).toEqual([world.ids.foreign]);
    });

    it('finds nothing when the tenant and the website of a scope do not belong together', async () => {
      const { world } = suite;
      const mine = await suite.store({ id: 'mixed', time: '12:30', units: [world.ids.anna] });
      const mixed = {
        tenantId: toTenantId(world.otherScope.tenantId),
        websiteId: world.scope.websiteId,
      };

      const found = unwrap(await bookings.findById(mixed, mine.booking.id));
      const service = unwrap(await services.findById(mixed, world.serviceId));

      expect(found).toBeNull();
      expect(service).toBeNull();
    });

    it('can neither store a booking in this website nor with a unit of it', async () => {
      const { world } = suite;
      const intruder = stored(world, { id: 'intruder', time: '07:00', units: [world.ids.anna] });

      const result = await bookings.create(world.otherScope, intruder, NOW);

      expect(result._unsafeUnwrapErr()).toMatchObject({ kind: 'infrastructure' });
      expect(unwrap(await bookings.findById(world.scope, intruder.booking.id))).toBeNull();
    });
  });
});
