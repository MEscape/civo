/**
 * Integration test of the booking persistence against a REAL Postgres.
 *
 * It proves the guarantees no mock can: that two requests for the same slot
 * cannot both succeed, that a shared session cannot be oversold, and that
 * every query is bound to its tenant.
 *
 * It does not run with the ordinary tests (they have no database). Needs the database of `DATABASE_URL` (see `vitest.integration.config.ts`) with the migrations
 * applied: `npm run test:integration`. Prisma's timestamp codec needs a global
 * `Temporal`; `@lib/db` installs a polyfill on runtimes without one.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth';
import type { TenantId } from '@modules/auth';
import { toActorId } from '@modules/auth/domain/models/ids';
import { BOOKING_ERROR_CODES } from '@modules/booking/domain/errors/booking-errors';
import { createBookableResourceDraft } from '@modules/booking/domain/models/bookable-resource';
import { createBookableServiceDraft } from '@modules/booking/domain/models/bookable-service';
import type { Booking } from '@modules/booking/domain/models/booking';
import { createBookingLocationDraft } from '@modules/booking/domain/models/booking-location';
import { toBookingReference } from '@modules/booking/domain/models/booking-reference';
import {
  toBookableResourceId,
  toBookableServiceId,
  toBookingLocationId,
  toWebsiteId,
} from '@modules/booking/domain/models/ids';
import type { NewBooking } from '@modules/booking/domain/ports/booking.repository';
import { PrismaBookableResourceRepository } from '@modules/booking/infrastructure/prisma/prisma-bookable-resource.repository';
import { PrismaBookableServiceRepository } from '@modules/booking/infrastructure/prisma/prisma-bookable-service.repository';
import { PrismaBookingLocationRepository } from '@modules/booking/infrastructure/prisma/prisma-booking-location.repository';
import { PrismaBookingRepository } from '@modules/booking/infrastructure/prisma/prisma-booking.repository';

import { systemClock } from '@lib/clock';
import { db, disconnectDb } from '@lib/db';

const MINUTE = 60_000;
const BASE = Date.UTC(2027, 5, 7, 8, 0); // Monday 2027-06-07 08:00 UTC
const NOW = new Date(Date.UTC(2027, 5, 1, 12, 0));
const HOLD_MINUTES = 10;

interface BookingOptions {
  readonly resources: readonly string[];
  readonly startMinutes: number;
  readonly status?: Booking['status'];
  readonly holdExpiresAt?: Date | null;
  readonly sessionKey?: string;
  readonly sessionCapacity?: number;
  readonly email?: string;
}

describe('booking persistence (real Postgres)', () => {
  const suffix = Math.random().toString(36).slice(2, 10);
  const tenantId: TenantId = toTenantId(`it-tenant-${suffix}`);
  const otherTenantId: TenantId = toTenantId(`it-other-${suffix}`);
  const locations = new PrismaBookingLocationRepository(systemClock);
  const resources = new PrismaBookableResourceRepository(systemClock);
  const services = new PrismaBookableServiceRepository(systemClock);
  const bookings = new PrismaBookingRepository();

  let websiteRecordId = '';
  let locationId = '';
  let serviceId = '';
  let desks: string[] = [];
  let counter = 0;

  beforeAll(async () => {
    // A tenant is its website: the table refuses any other pairing of the two ids.
    const website = await db.orm.public.Website.create({
      id: tenantId,
      tenantId,
      name: 'Integration',
      slug: `it-${suffix}`,
      templateKey: 'civic',
    });
    websiteRecordId = website.id;
    const websiteId = toWebsiteId(website.id);

    const day = { intervals: [{ start: '08:00', end: '18:00' }], breaks: [] };
    const location = (
      await locations.create({
        tenantId,
        draft: createBookingLocationDraft({
          websiteId,
          name: 'Town hall',
          address: null,
          timeZone: 'UTC',
          openingHours: { weekly: Array.from({ length: 7 }, () => day), exceptions: [] },
          isActive: true,
        })._unsafeUnwrap(),
      })
    )._unsafeUnwrap();
    locationId = location.id;

    desks = [];
    for (const name of ['Desk 1', 'Desk 2', 'Desk 3']) {
      const desk = (
        await resources.create({
          tenantId,
          draft: createBookableResourceDraft({
            websiteId,
            locationId: location.id,
            name,
            type: 'service-desk',
            skills: [],
            capacity: null,
            availability: null,
            isActive: true,
          })._unsafeUnwrap(),
        })
      )._unsafeUnwrap();
      desks.push(desk.id);
    }

    const service = (
      await services.create({
        tenantId,
        draft: createBookableServiceDraft({
          websiteId,
          name: 'Passport',
          description: null,
          category: null,
          isActive: true,
          durationMinutes: 30,
          preparationMinutes: 0,
          cleanupMinutes: 0,
          slotIntervalMinutes: 30,
          locationIds: [location.id],
          requirements: [{ resourceType: 'service-desk', skills: [], count: 1, resourceIds: null }],
          participantsPerBooking: 1,
          participantsPerSession: 1,
          noticeMinutes: 0,
          horizonDays: 365,
          availability: null,
          cancellation: {
            isAllowed: true,
            deadlineMinutes: 60,
            allowedActors: ['customer', 'staff'],
          },
          rescheduling: {
            isAllowed: true,
            deadlineMinutes: 60,
            allowedActors: ['customer', 'staff'],
          },
          information: [{ field: 'email', isRequired: true }],
          requiredDocuments: [],
          instructions: null,
        })._unsafeUnwrap(),
      })
    )._unsafeUnwrap();
    serviceId = service.id;
  });

  afterAll(async () => {
    // Bookings first: their resources and service are protected from deletion while in use.
    await db.orm.public.Booking.where({ tenantId }).deleteAndCount();
    if (websiteRecordId !== '') {
      await db.orm.public.Website.where({ id: websiteRecordId }).deleteAndCount();
    }
    await disconnectDb();
  });

  function deskAt(index: number): string {
    return desks[index] ?? '';
  }

  function nextReference(): string {
    counter += 1;
    return `${suffix.toUpperCase().replaceAll(/[ILOU]/g, '1')}${String(counter).padStart(2, '0')}`
      .slice(0, 10)
      .padEnd(10, '0');
  }

  function defaultHoldExpiry(options: BookingOptions, status: Booking['status']): Date | null {
    if (options.holdExpiresAt !== undefined) {
      return options.holdExpiresAt;
    }
    return status === 'held' ? new Date(NOW.getTime() + HOLD_MINUTES * MINUTE) : null;
  }

  function aBooking(options: BookingOptions): NewBooking {
    const start = BASE + options.startMinutes * MINUTE;
    const end = start + 30 * MINUTE;
    const reference = nextReference();
    const status = options.status ?? 'held';
    // A confirmed booking always knows who booked (the table refuses one that does not).
    const email =
      options.email ?? (status === 'confirmed' ? `guest-${reference}@example.org` : undefined);
    return {
      tenantId,
      websiteId: toWebsiteId(websiteRecordId),
      serviceId: toBookableServiceId(serviceId),
      locationId: toBookingLocationId(locationId),
      reference: toBookingReference(reference),
      status,
      start: new Date(start),
      end: new Date(end),
      occupiedStart: new Date(start),
      occupiedEnd: new Date(end),
      participants: 1,
      resourceIds: options.resources.map(toBookableResourceId),
      sessionKey: options.sessionKey ?? `booking:${reference}`,
      sessionCapacity: options.sessionCapacity ?? 1,
      customer:
        email === undefined
          ? null
          : {
              firstName: 'Ada',
              lastName: 'Lovelace',
              email,
              phone: null,
              referenceNumber: null,
              notes: null,
            },
      holdExpiresAt: defaultHoldExpiry(options, status),
      rescheduleCount: 0,
      cancelledAt: null,
      cancelledBy: null,
    };
  }

  const create = (options: BookingOptions, now: Date = NOW) =>
    bookings.create(aBooking(options), now);

  it('names configuration and bookings by id, only within its own website and tenant', async () => {
    const websiteId = toWebsiteId(websiteRecordId);
    const created = (await create({ resources: [deskAt(0)], startMinutes: 900 }))._unsafeUnwrap();
    const missing = toBookableServiceId('00000000-0000-4000-8000-000000000000');

    const named = (
      await services.findNames(websiteId, tenantId, [toBookableServiceId(serviceId), missing])
    )._unsafeUnwrap();
    expect(named).toEqual([{ id: serviceId, name: expect.any(String) }]);
    expect(
      (
        await services.findNames(websiteId, otherTenantId, [toBookableServiceId(serviceId)])
      )._unsafeUnwrap(),
    ).toEqual([]);
    expect(
      (
        await locations.findNames(websiteId, tenantId, [toBookingLocationId(locationId)])
      )._unsafeUnwrap(),
    ).toEqual([{ id: locationId, name: 'Town hall' }]);
    expect(
      (
        await resources.findNames(websiteId, tenantId, [toBookableResourceId(deskAt(0))])
      )._unsafeUnwrap(),
    ).toHaveLength(1);
    expect(
      (await bookings.findReferences({ websiteId, tenantId }, [created.id]))._unsafeUnwrap(),
    ).toEqual([{ id: created.id, reference: created.reference }]);
    expect(
      (
        await bookings.findReferences({ websiteId, tenantId: otherTenantId }, [created.id])
      )._unsafeUnwrap(),
    ).toEqual([]);
  });

  it('stores configuration and finds it again, only for its own tenant', async () => {
    const found = (
      await locations.findById(toBookingLocationId(locationId), tenantId)
    )._unsafeUnwrap();
    expect(found?.name).toBe('Town hall');
    expect(found?.openingHours.weekly[1].intervals).toEqual([
      { startMinute: 480, endMinute: 1080 },
    ]);

    const foreign = (
      await locations.findById(toBookingLocationId(locationId), otherTenantId)
    )._unsafeUnwrap();
    expect(foreign).toBeNull();

    const listed = (
      await resources.listByWebsite(toWebsiteId(websiteRecordId), tenantId, 10)
    )._unsafeUnwrap();
    expect(listed.map((resource) => resource.name)).toEqual(['Desk 1', 'Desk 2', 'Desk 3']);
  });

  it('holds the resource for the whole span and returns the booking with its resources', async () => {
    const created = (await create({ resources: [deskAt(0)], startMinutes: 0 }))._unsafeUnwrap();
    expect(created.status).toBe('held');
    expect(created.resourceIds).toEqual([deskAt(0)]);

    const found = (await bookings.findById(created.id, tenantId))._unsafeUnwrap();
    expect(found?.reference).toBe(created.reference);
    expect(found?.resourceIds).toEqual([deskAt(0)]);
    expect((await bookings.findById(created.id, otherTenantId))._unsafeUnwrap()).toBeNull();
  });

  it('lets exactly one of many simultaneous requests take the same slot', async () => {
    const attempts = await Promise.all(
      Array.from({ length: 8 }, async () => create({ resources: [deskAt(1)], startMinutes: 120 })),
    );
    const lost = attempts.filter((attempt) => attempt.isErr());
    expect(attempts.filter((attempt) => attempt.isOk())).toHaveLength(1);
    expect(lost).toHaveLength(7);
    for (const attempt of lost) {
      expect(attempt._unsafeUnwrapErr().code).toBe(BOOKING_ERROR_CODES.bookingConflict);
    }
  });

  it('allows touching spans and refuses an overlap', async () => {
    const first = await create({ resources: [deskAt(2)], startMinutes: 240 });
    const touching = await create({ resources: [deskAt(2)], startMinutes: 270 });
    const overlapping = await create({ resources: [deskAt(2)], startMinutes: 255 });
    expect(first.isOk()).toBe(true);
    expect(touching.isOk()).toBe(true);
    expect(overlapping._unsafeUnwrapErr().code).toBe(BOOKING_ERROR_CODES.bookingConflict);
  });

  it('never leaves a booking half stored when one of its resources conflicts', async () => {
    await create({ resources: [deskAt(1)], startMinutes: 360 });
    const both = await create({ resources: [deskAt(0), deskAt(1)], startMinutes: 360 });
    expect(both.isErr()).toBe(true);

    const blocking = (
      await bookings.listBlocking(
        { websiteId: toWebsiteId(websiteRecordId), tenantId },
        { start: BASE + 350 * MINUTE, end: BASE + 400 * MINUTE },
        50,
      )
    )._unsafeUnwrap();
    expect(blocking).toHaveLength(1);
    expect(blocking[0]?.resourceIds).toEqual([deskAt(1)]);
  });

  it('releases a hold that ran out when someone else needs the slot', async () => {
    const stale = (
      await create({
        resources: [deskAt(0)],
        startMinutes: 480,
        holdExpiresAt: new Date(NOW.getTime() + 5 * MINUTE),
      })
    )._unsafeUnwrap();

    const later = new Date(NOW.getTime() + 30 * MINUTE);
    expect((await create({ resources: [deskAt(0)], startMinutes: 480 }, later)).isOk()).toBe(true);
    expect((await bookings.findById(stale.id, tenantId))._unsafeUnwrap()?.status).toBe('expired');
  });

  it('does not oversell a shared session however many request at once', async () => {
    const key = `session:${serviceId}:${locationId}:${BASE + 600 * MINUTE}`;
    const attempts = await Promise.all(
      Array.from({ length: 6 }, async () =>
        create({
          resources: [deskAt(0)],
          startMinutes: 600,
          sessionKey: key,
          sessionCapacity: 4,
        }),
      ),
    );
    const refused = attempts.filter((attempt) => attempt.isErr());
    expect(attempts.filter((attempt) => attempt.isOk())).toHaveLength(4);
    expect(refused).toHaveLength(2);
    for (const attempt of refused) {
      expect(attempt._unsafeUnwrapErr().code).toBe(BOOKING_ERROR_CODES.capacityExceeded);
    }
  });

  it('confirms with a compare-and-swap, refuses a stale base and frees the slot on cancel', async () => {
    const held = (await create({ resources: [deskAt(0)], startMinutes: 720 }))._unsafeUnwrap();

    const confirmed = (
      await bookings.save(
        {
          ...held,
          status: 'confirmed',
          holdExpiresAt: null,
          customer: {
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'Ada@Example.org',
            phone: null,
            referenceNumber: null,
            notes: null,
          },
        },
        { status: held.status, updatedAt: held.updatedAt },
        NOW,
      )
    )._unsafeUnwrap();
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.customer?.email).toBe('Ada@Example.org');

    // The same base again is stale: the booking has moved on.
    const stale = await bookings.save(
      { ...held, status: 'cancelled' },
      { status: held.status, updatedAt: held.updatedAt },
      NOW,
    );
    expect(stale._unsafeUnwrapErr().code).toBe(BOOKING_ERROR_CODES.bookingStale);

    expect((await create({ resources: [deskAt(0)], startMinutes: 720 })).isErr()).toBe(true);

    await bookings.save(
      { ...confirmed, status: 'cancelled', cancelledAt: NOW, cancelledBy: 'customer' },
      { status: confirmed.status, updatedAt: confirmed.updatedAt },
      NOW,
    );
    expect((await create({ resources: [deskAt(0)], startMinutes: 720 })).isOk()).toBe(true);
  });

  it('moves a confirmed booking and refuses a move onto another booking', async () => {
    const mine = (
      await create({
        resources: [deskAt(2)],
        startMinutes: 800,
        status: 'confirmed',
        email: 'move@example.org',
      })
    )._unsafeUnwrap();
    const blocker = (
      await create({ resources: [deskAt(2)], startMinutes: 860, status: 'confirmed' })
    )._unsafeUnwrap();

    const moveOnto = await bookings.save(
      {
        ...mine,
        start: blocker.start,
        end: blocker.end,
        occupiedStart: blocker.occupiedStart,
        occupiedEnd: blocker.occupiedEnd,
        rescheduleCount: 1,
      },
      { status: mine.status, updatedAt: mine.updatedAt },
      NOW,
    );
    expect(moveOnto._unsafeUnwrapErr().code).toBe(BOOKING_ERROR_CODES.bookingConflict);

    // The failed move changed nothing: the booking is where it was.
    const unchanged = (await bookings.findById(mine.id, tenantId))._unsafeUnwrap();
    expect(unchanged?.start.getTime()).toBe(mine.start.getTime());

    const free = new Date(BASE + 900 * MINUTE);
    const end = new Date(free.getTime() + 30 * MINUTE);
    const moved = (
      await bookings.save(
        { ...mine, start: free, end, occupiedStart: free, occupiedEnd: end, rescheduleCount: 1 },
        { status: mine.status, updatedAt: mine.updatedAt },
        NOW,
      )
    )._unsafeUnwrap();
    expect(moved.start.getTime()).toBe(free.getTime());
    expect(moved.rescheduleCount).toBe(1);
  });

  it('counts live bookings by e-mail and releases expired holds in bulk', async () => {
    const websiteId = toWebsiteId(websiteRecordId);
    const live = (
      await bookings.countLiveByEmail({ websiteId, tenantId }, 'MOVE@example.org', NOW)
    )._unsafeUnwrap();
    expect(live).toBe(1);

    const holds = (await bookings.countLiveHolds({ websiteId, tenantId }, NOW))._unsafeUnwrap();
    expect(holds).toBeGreaterThan(0);

    const tomorrow = new Date(NOW.getTime() + 24 * 60 * MINUTE);
    const released = (
      await bookings.releaseExpiredHolds({ websiteId, tenantId }, tomorrow, 100)
    )._unsafeUnwrap();
    expect(released).toBeGreaterThan(0);
    expect((await bookings.countLiveHolds({ websiteId, tenantId }, tomorrow))._unsafeUnwrap()).toBe(
      0,
    );
  });
  it('narrows the calendar to the bookings on the resources assigned to a person, in the query itself', async () => {
    const websiteId = toWebsiteId(websiteRecordId);
    const scope = { websiteId, tenantId };
    const [anna, ben] = [toActorId(`anna-${suffix}`), toActorId(`ben-${suffix}`)];

    const employeeOf = async (name: string, actor: string) =>
      (
        await resources.create({
          tenantId,
          draft: createBookableResourceDraft({
            websiteId,
            locationId: toBookingLocationId(locationId),
            name,
            type: 'employee',
            skills: [],
            capacity: null,
            availability: null,
            isActive: true,
            assignedActorId: actor,
          })._unsafeUnwrap(),
        })
      )._unsafeUnwrap();
    const annaResource = await employeeOf('Anna', anna);
    const benResource = await employeeOf('Ben', ben);

    // Ben's booking comes first, so a limit that is not applied to Anna's own would cut hers off.
    const benFirst = (
      await create({ resources: [benResource.id], startMinutes: 5000, status: 'confirmed' })
    )._unsafeUnwrap();
    const annaSecond = (
      await create({ resources: [annaResource.id], startMinutes: 5060, status: 'confirmed' })
    )._unsafeUnwrap();
    const shared = (
      await create({
        resources: [annaResource.id, benResource.id],
        startMinutes: 5120,
        status: 'confirmed',
      })
    )._unsafeUnwrap();

    const span = { start: BASE + 4990 * MINUTE, end: BASE + 5200 * MINUTE };
    const idsOf = async (query: Parameters<typeof bookings.listInRange>[1]) =>
      (await bookings.listInRange(scope, query))._unsafeUnwrap().map((booking) => booking.id);

    // Nobody narrowed: the whole calendar.
    expect(await idsOf({ span, filter: {}, limit: 10 })).toEqual([
      benFirst.id,
      annaSecond.id,
      shared.id,
    ]);
    // Anna: her own and the shared one, never Ben's alone.
    expect(await idsOf({ span, filter: {}, limit: 10, assignedTo: anna })).toEqual([
      annaSecond.id,
      shared.id,
    ]);
    expect(await idsOf({ span, filter: {}, limit: 10, assignedTo: ben })).toEqual([
      benFirst.id,
      shared.id,
    ]);
    // The limit counts only what is hers: Ben's earlier booking does not use it up.
    expect(await idsOf({ span, filter: {}, limit: 1, assignedTo: anna })).toEqual([annaSecond.id]);
    // A filter naming Ben's resource cannot widen Anna's view beyond what also occupies hers.
    expect(
      await idsOf({
        span,
        filter: { resourceId: toBookableResourceId(benResource.id) },
        limit: 10,
        assignedTo: anna,
      }),
    ).toEqual([shared.id]);
    // Someone with nothing assigned sees nothing, and another tenant's staff member nothing either.
    expect(
      await idsOf({ span, filter: {}, limit: 10, assignedTo: toActorId(`carla-${suffix}`) }),
    ).toEqual([]);
    expect(
      (
        await bookings.listInRange(
          { websiteId, tenantId: otherTenantId },
          { span, filter: {}, limit: 10, assignedTo: anna },
        )
      )._unsafeUnwrap(),
    ).toEqual([]);

    // The resource list is narrowed in the store the same way.
    const mine = (await resources.listAssignedTo(scope, anna, 10))._unsafeUnwrap();
    expect(mine.map((resource) => resource.id)).toEqual([annaResource.id]);
    expect(
      (
        await resources.listAssignedTo({ websiteId, tenantId: otherTenantId }, anna, 10)
      )._unsafeUnwrap(),
    ).toEqual([]);
  });

  it('keeps the hours employees may work and a manager change, and reads them back', async () => {
    const websiteId = toWebsiteId(websiteRecordId);
    const day = { intervals: [{ start: '08:00', end: '18:00' }], breaks: [] };
    const mornings = {
      intervals: [{ start: '08:00', end: '12:00' }],
      breaks: [],
    };
    const place = (
      await locations.create({
        tenantId,
        draft: createBookingLocationDraft({
          websiteId,
          name: 'Annex',
          address: null,
          timeZone: 'UTC',
          openingHours: { weekly: Array.from({ length: 7 }, () => day), exceptions: [] },
          staffHours: { weekly: Array.from({ length: 7 }, () => mornings), exceptions: [] },
          isActive: true,
        })._unsafeUnwrap(),
      })
    )._unsafeUnwrap();
    const changedAt = new Date(Date.UTC(2027, 5, 2, 9, 30));
    const person = (
      await resources.create({
        tenantId,
        draft: createBookableResourceDraft({
          websiteId,
          locationId: place.id,
          name: 'Dora',
          type: 'employee',
          skills: [],
          capacity: null,
          availability: null,
          isActive: true,
          assignedActorId: toActorId(`dora-${suffix}`),
          managerChange: { at: changedAt, kinds: ['hours', 'services'] },
        })._unsafeUnwrap(),
      })
    )._unsafeUnwrap();

    const location = (await locations.findById(place.id, tenantId))._unsafeUnwrap();
    const employee = (await resources.findById(person.id, tenantId))._unsafeUnwrap();

    expect(location?.staffHours?.weekly[1]?.intervals).toEqual([
      { startMinute: 480, endMinute: 720 },
    ]);
    expect(employee?.managerChange).toEqual({ at: changedAt, kinds: ['hours', 'services'] });

    const cleared = (
      await resources.update(person.id, tenantId, {
        ...createBookableResourceDraft({
          websiteId,
          locationId: place.id,
          name: 'Dora',
          type: 'employee',
          skills: [],
          capacity: null,
          availability: null,
          isActive: true,
          assignedActorId: toActorId(`dora-${suffix}`),
        })._unsafeUnwrap(),
      })
    )._unsafeUnwrap();
    expect(cleared.managerChange).toBeNull();
  });

  it('knows what bookings refer to, and removes what nothing refers to', async () => {
    const websiteId = toWebsiteId(websiteRecordId);
    const booked = await create({
      resources: [deskAt(0)],
      startMinutes: 7000,
      status: 'confirmed',
    });
    booked._unsafeUnwrap();
    const subjects = [
      { kind: 'service', id: toBookableServiceId(serviceId) },
      { kind: 'location', id: toBookingLocationId(locationId) },
      { kind: 'resource', id: toBookableResourceId(deskAt(0)) },
    ] as const;
    const afterBooking = new Date(BASE + 8000 * MINUTE);

    for (const subject of subjects) {
      expect((await bookings.isReferenced(subject, tenantId))._unsafeUnwrap()).toBe(true);
      expect((await bookings.hasUpcoming(subject, tenantId, NOW))._unsafeUnwrap()).toBe(true);
      expect((await bookings.hasUpcoming(subject, tenantId, afterBooking))._unsafeUnwrap()).toBe(
        false,
      );
      // Another tenant's actor cannot see them referred to.
      if (subject.kind !== 'resource') {
        expect((await bookings.isReferenced(subject, otherTenantId))._unsafeUnwrap()).toBe(false);
      }
    }

    const closedWeek = Array.from({ length: 7 }, () => ({ intervals: [], breaks: [] }));
    const spare = (
      await locations.create({
        tenantId,
        draft: createBookingLocationDraft({
          websiteId,
          name: 'Never booked',
          address: null,
          timeZone: 'UTC',
          openingHours: { weekly: closedWeek, exceptions: [] },
          isActive: true,
        })._unsafeUnwrap(),
      })
    )._unsafeUnwrap();

    expect(
      (await bookings.isReferenced({ kind: 'location', id: spare.id }, tenantId))._unsafeUnwrap(),
    ).toBe(false);
    // A stranger's tenant removes nothing; the owner's removes it, and removing twice is fine.
    (await locations.deleteById(spare.id, otherTenantId))._unsafeUnwrap();
    expect((await locations.findById(spare.id, tenantId))._unsafeUnwrap()).not.toBeNull();
    (await locations.deleteById(spare.id, tenantId))._unsafeUnwrap();
    expect((await locations.findById(spare.id, tenantId))._unsafeUnwrap()).toBeNull();
    expect((await locations.deleteById(spare.id, tenantId)).isOk()).toBe(true);
  });
});
