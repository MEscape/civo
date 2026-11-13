/**
 * The administration of physical resources against a real database: what a manager creates is
 * what the lists show, a change that would leave bookings without the resource is refused until
 * the manager has seen them, and nobody reaches a resource that is not theirs to look after.
 */
import { describe, expect, it } from 'vitest';

import type {
  CreateResourceInput,
  ResourceInput,
} from '@modules/booking/application/contracts/resource-inputs';
import {
  BOOKING_ERROR_CODES as CODES,
  BOOKING_VALIDATION_CODES as FIELDS,
} from '@modules/booking/domain/errors/booking-errors';

import { db } from '@lib/db';

import { useServiceSuite } from '../support/service-suite';

const MONDAY = '2027-01-11';

const week = () =>
  Array.from({ length: 7 }, (_, day) => ({
    intervals: day < 5 ? [{ start: '08:00', end: '17:00' }] : [],
    breaks: [],
  }));

describe('administration of resources (real Postgres)', () => {
  const { harness, suite, admin, employee, viewer, createService, locationId } = useServiceSuite();

  const fields = (overrides: Partial<ResourceInput> = {}): ResourceInput => ({
    name: 'Besprechungsraum 2',
    capacity: 4,
    setupMinutes: 0,
    teardownMinutes: 5,
    internalNote: 'Für Beratungen mit bis zu 4 Personen',
    followsLocation: true,
    openingHours: { weekly: week(), exceptions: [] },
    ...overrides,
  });

  const create = (overrides: Partial<CreateResourceInput> = {}) =>
    harness.commands.createBookableResource.execute({
      websiteId: String(suite.world.scope.websiteId),
      ...fields(),
      locationId: locationId(),
      type: 'meeting-room',
      ...overrides,
    });

  /** The world's room, as the administration reads it, after giving it `capacity` places. */
  async function worldRoom(capacity: number) {
    await db.orm.public.BookableResource.where({ id: suite.world.ids.room }).updateAndCount({
      capacity,
      availability: null,
    });
    return (
      await harness.queries.getResource.execute({
        websiteId: String(suite.world.scope.websiteId),
        resourceId: suite.world.ids.room,
      })
    )._unsafeUnwrap();
  }

  const changeRoom = (
    version: string,
    overrides: Partial<ResourceInput>,
    acknowledgeImpact = false,
  ) =>
    harness.commands.updateBookableResource.execute({
      websiteId: String(suite.world.scope.websiteId),
      ...fields({
        name: 'Raum',
        capacity: 2,
        setupMinutes: 0,
        teardownMinutes: 0,
        internalNote: '',
      }),
      ...overrides,
      resourceId: suite.world.ids.room,
      expectedVersion: version,
      acknowledgeImpact,
    });

  describe('creating', () => {
    it('stores a room with its places and buffers, and records who did it', async () => {
      const created = (await create())._unsafeUnwrap();

      expect(created).toMatchObject({
        name: 'Besprechungsraum 2',
        type: 'meeting-room',
        places: 4,
        teardownMinutes: 5,
        followsLocation: true,
        blocks: [],
        usedBy: [],
        status: 'active',
        location: { id: locationId() },
      });
      expect(harness.events.at(-1)).toMatchObject({
        type: 'booking.resource_created',
        resourceId: created.id,
      });
    });

    it('refuses a person, a kind that does not exist and impossible places, all at once', async () => {
      const refused = (
        await create({ type: 'employee', capacity: 0, name: ' ' })
      )._unsafeUnwrapErr();

      expect(refused).toMatchObject({
        kind: 'validation',
        fieldErrors: {
          type: [FIELDS.resourceTypeInvalid],
          capacity: [FIELDS.capacityInvalid],
          name: [FIELDS.nameInvalid],
        },
      });
    });

    it('accepts only blocks as exceptions', async () => {
      const refused = (
        await create({
          openingHours: {
            weekly: week(),
            exceptions: [
              {
                kind: 'additional',
                from: MONDAY,
                to: MONDAY,
                day: { intervals: [{ start: '18:00', end: '19:00' }], breaks: [] },
              },
            ],
          },
        })
      )._unsafeUnwrapErr();

      expect(refused).toMatchObject({
        fieldErrors: { 'openingHours.exceptions': [FIELDS.exceptionInvalid] },
      });
    });

    it('keeps own hours and blocks, and reads them back as the form sent them', async () => {
      const created = (
        await create({
          followsLocation: false,
          openingHours: {
            weekly: week().map((day, index) =>
              index === 0 ? { ...day, intervals: [{ start: '08:00', end: '12:00' }] } : day,
            ),
            exceptions: [{ kind: 'closed', from: '2027-05-12', to: '2027-05-14' }],
          },
        })
      )._unsafeUnwrap();

      expect(created.followsLocation).toBe(false);
      expect(created.weekly[0]).toEqual({
        intervals: [{ start: '08:00', end: '12:00' }],
        breaks: [],
      });
      expect(created.blocks).toEqual([{ from: '2027-05-12', to: '2027-05-14' }]);
    });

    it('is the configurators’ alone: an employee and a viewer are refused', async () => {
      harness.actAs(employee());
      expect((await create())._unsafeUnwrapErr().kind).toBe('forbidden');
      harness.actAs(viewer());
      expect((await create())._unsafeUnwrapErr().kind).toBe('forbidden');
    });
  });

  describe('listing', () => {
    it('shows the services that use a resource, and filters by kind and name', async () => {
      await createService({ name: 'Wohnsitz anmelden' });

      const rooms = (
        await harness.queries.listResources.execute({
          websiteId: String(suite.world.scope.websiteId),
          locationId: locationId(),
          type: 'room',
          page: {},
        })
      )._unsafeUnwrap();

      expect(rooms.items.every((item) => item.type === 'room')).toBe(true);
      const room = rooms.items.find((item) => item.id === suite.world.ids.room);
      expect(room?.usedBy.map((use) => [use.serviceName, use.isRequired])).toContainEqual([
        'Wohnsitz anmelden',
        true,
      ]);

      const none = (
        await harness.queries.listResources.execute({
          websiteId: String(suite.world.scope.websiteId),
          locationId: locationId(),
          search: 'gibt es nicht',
          page: {},
        })
      )._unsafeUnwrap();
      expect(none.total).toBe(0);
    });

    it('never lists a person, and finds no person or another website’s resource by id', async () => {
      const all = (
        await harness.queries.listResources.execute({
          websiteId: String(suite.world.scope.websiteId),
          locationId: locationId(),
          page: {},
        })
      )._unsafeUnwrap();
      expect(all.items.map((item) => item.id)).not.toContain(suite.world.ids.anna);

      for (const resourceId of [suite.world.ids.anna, suite.world.ids.foreign]) {
        expect(
          (
            await harness.queries.getResource.execute({
              websiteId: String(suite.world.scope.websiteId),
              resourceId,
            })
          )._unsafeUnwrapErr().code,
        ).toBe(CODES.resourceNotFound);
      }
    });
  });

  describe('changing', () => {
    it('refuses a change made from an old version', async () => {
      const room = await worldRoom(2);
      expect((await changeRoom(room.version, {}))._unsafeUnwrap().name).toBe('Raum');

      expect(
        (await changeRoom(room.version, { name: 'Noch ein Raum' }))._unsafeUnwrapErr().code,
      ).toBe(CODES.resourceStale);
    });

    it('asks before taking places that bookings already use, and then lets them stand', async () => {
      const room = await worldRoom(2);
      const first = await suite.store({
        id: 'places-a',
        date: MONDAY,
        time: '10:00',
        units: [suite.world.ids.room],
      });
      const second = await suite.store({
        id: 'places-b',
        date: MONDAY,
        time: '10:00',
        units: [suite.world.ids.room],
      });

      const preview = (
        await harness.queries.previewResourceChange.execute({
          websiteId: String(suite.world.scope.websiteId),
          resourceId: suite.world.ids.room,
          resource: fields({ capacity: 1 }),
        })
      )._unsafeUnwrap();
      expect(preview.affected.map((entry) => [entry.bookingId, entry.reason])).toEqual(
        [
          [first.booking.id, 'over-capacity'],
          [second.booking.id, 'over-capacity'],
        ].sort(),
      );
      expect((await changeRoom(room.version, { capacity: 1 }))._unsafeUnwrapErr().code).toBe(
        CODES.resourceImpactUnacknowledged,
      );

      const saved = (await changeRoom(room.version, { capacity: 1 }, true))._unsafeUnwrap();
      expect(saved.places).toBe(1);
      expect(harness.events.at(-1)).toMatchObject({
        type: 'booking.resource_updated',
        sections: ['details'],
        leftOpen: 2,
      });
      const statuses = await db.orm.public.Booking.where((booking) =>
        booking.id.in([first.booking.id, second.booking.id]),
      )
        .select('status')
        .all();
      expect(statuses.every((row) => row.status === 'CONFIRMED')).toBe(true);
    });

    it('asks before blocking a day a booking uses the resource on', async () => {
      const room = await worldRoom(4);
      const booked = await suite.store({
        id: 'block-a',
        date: '2027-01-12',
        time: '09:00',
        units: [suite.world.ids.room],
      });
      const block = { kind: 'closed' as const, from: '2027-01-12', to: '2027-01-12' };

      const preview = (
        await harness.queries.previewResourceChange.execute({
          websiteId: String(suite.world.scope.websiteId),
          resourceId: suite.world.ids.room,
          resource: fields({ capacity: 4, openingHours: { weekly: week(), exceptions: [block] } }),
        })
      )._unsafeUnwrap();

      expect(preview.affected).toEqual([
        expect.objectContaining({ bookingId: booked.booking.id, reason: 'resource-unavailable' }),
      ]);
      expect(
        (
          await changeRoom(room.version, {
            capacity: 4,
            openingHours: { weekly: week(), exceptions: [block] },
          })
        )._unsafeUnwrapErr().code,
      ).toBe(CODES.resourceImpactUnacknowledged);
    });

    it('saves a change that affects nothing without asking', async () => {
      const room = await worldRoom(4);

      const saved = (
        await changeRoom(room.version, { capacity: 6, internalNote: 'Neu gestrichen' })
      )._unsafeUnwrap();

      expect(saved).toMatchObject({ places: 6, internalNote: 'Neu gestrichen' });
    });
  });

  it('reads as the administrator again for the next file', () => {
    harness.actAs(admin());
  });
});
