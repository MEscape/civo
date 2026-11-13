import { describe, expect, it } from 'vitest';

import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';
import { toBookingId } from '@modules/booking/domain/models/ids';

import { db } from '@lib/db';

import { actorOf } from '../support/application-harness';
import { bookings } from '../support/persistence-suite';
import { useServiceSuite } from '../support/service-suite';
import { at as instantAt, clock } from '../support/time-fixtures';

const { harness, suite, admin, input, createService, locationId, at } = useServiceSuite();

const MONDAY = '2027-01-11';

/** The value of a result that must be ok; the refusal, spelled out, when it is not. */
function ok<T>(result: { isOk(): boolean; value?: T; error?: unknown }): T {
  if (!result.isOk()) {
    throw new Error(JSON.stringify(result.error));
  }
  return result.value as T;
}

const MS_PER_MINUTE = 60_000;

/** What a stored booking was made with: how long it lasts, and the name and skills it kept. */
async function madeWith(id: string) {
  const stored = (await bookings.findById(suite.world.scope, toBookingId(id)))._unsafeUnwrap();
  const { booking, placement } = stored ?? { booking: null, placement: null };
  return {
    minutes: booking === null ? null : (booking.end - booking.start) / MS_PER_MINUTE,
    name: placement?.snapshot?.serviceName ?? null,
    skills: placement?.snapshot?.requirements[0]?.skills ?? null,
  };
}

const staffBooking = (serviceId: string, time: string, email = 'kim@example.org') =>
  harness.commands.createBookingAsStaff.execute({
    websiteId: String(suite.world.scope.websiteId),
    serviceId,
    locationId: locationId(),
    start: at(time, MONDAY),
    customer: { firstName: 'Kim', lastName: 'Muster', email },
  });

describe('defining a service', () => {
  it('builds the passport appointment of the mockups and makes it bookable', async () => {
    const created = await createService();

    expect(created).toMatchObject({
      name: 'Personalausweis beantragen',
      category: 'Ausweise & Pässe',
      documents: ['Altes Dokument', 'biometrisches Foto'],
      durationMinutes: 20,
      preparationMinutes: 5,
      cleanupMinutes: 10,
      employee: 'qualified',
      qualification: 'ausweise',
      origin: { kind: 'own' },
      isActive: true,
      isOnlineBookable: true,
      futureBookingCount: 0,
    });
    expect(created.resources.map((resource) => [resource.id, resource.isRequired])).toEqual([
      [suite.world.ids.room, true],
    ]);

    const slots = (
      await harness.queries.getAvailableSlots.execute({
        websiteId: String(suite.world.scope.websiteId),
        serviceId: created.id,
        locationId: locationId(),
        from: MONDAY,
        to: MONDAY,
      })
    )._unsafeUnwrap();
    expect(slots.slots.length).toBeGreaterThan(0);
  });

  it('holds the employee for preparation and clean-up and the room for the appointment alone', async () => {
    const created = await createService();

    const made = await staffBooking(created.id, '10:00');
    if (made.isErr()) {
      throw new Error(JSON.stringify(made.error));
    }
    const booking = made.value;

    const stored = (
      await bookings.findById(suite.world.scope, toBookingId(booking.id))
    )._unsafeUnwrap();
    const spans = new Map(
      stored?.booking.assignments.map((unit) => [
        unit.resourceType,
        `${clock(unit.occupied.start).slice(11)}-${clock(unit.occupied.end).slice(11)}`,
      ]),
    );
    expect(spans.get('employee')).toBe('09:55-10:30');
    expect(spans.get('room')).toBe('10:00-10:20');
    expect(clock(stored?.booking.occupied.start ?? instantAt(MONDAY, '00:00')).slice(11)).toBe(
      '09:55',
    );
  });

  it('keeps the name, the length and the requirements a booking was made with', async () => {
    const created = await createService();
    const booking = ok(await staffBooking(created.id, '11:00'));

    const updated = ok(
      await harness.commands.updateBookableService.execute({
        websiteId: String(suite.world.scope.websiteId),
        ...input({
          name: 'Personalausweis neu',
          durationMinutes: 40,
          employee: 'any',
          qualification: '',
        }),
        locationId: locationId(),
        serviceId: created.id,
        expectedVersion: created.version,
        expectedSettingVersion: created.settingVersion,
        acknowledgeShared: false,
      }),
    );
    const second = ok(await staffBooking(created.id, '14:00', 'second@example.org'));

    expect(updated).toMatchObject({ name: 'Personalausweis neu', durationMinutes: 40 });
    // The earlier booking still lasts 20 minutes and still carries its own name and requirements.
    expect(await madeWith(booking.id)).toEqual({
      minutes: 20,
      name: 'Personalausweis beantragen',
      skills: ['ausweise'],
    });
    // The new one is made with the new definition.
    expect(await madeWith(second.id)).toEqual({
      minutes: 40,
      name: 'Personalausweis neu',
      skills: [],
    });
  });

  it('reads every problem of the form at once, at its own field', async () => {
    const result = await harness.commands.createBookableService.execute({
      websiteId: String(suite.world.scope.websiteId),
      ...input({
        name: '  ',
        durationMinutes: 0,
        noticeMinutes: 100 * 24 * 60,
        horizonDays: 90,
        cancelUntilMinutes: -1,
        actors: [],
        employee: 'qualified',
        qualification: '',
      }),
      locationId: locationId(),
    });

    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: 'validation',
      fieldErrors: {
        name: ['booking.validation.name_invalid'],
        durationMinutes: ['booking.validation.duration_invalid'],
        noticeMinutes: ['booking.validation.notice_not_before_horizon'],
        cancelUntilMinutes: ['booking.validation.deadline_invalid'],
        actors: ['booking.validation.actors_required'],
        qualification: ['booking.validation.qualification_invalid'],
      },
    });
  });

  it('refuses a resource that cannot serve the location, or is a person', async () => {
    const result = await harness.commands.createBookableService.execute({
      websiteId: String(suite.world.scope.websiteId),
      ...input({
        resources: [
          { resourceId: suite.world.ids.foreign, isRequired: true },
          { resourceId: suite.world.ids.anna, isRequired: false },
        ],
      }),
      locationId: locationId(),
    });

    expect(result._unsafeUnwrapErr()).toMatchObject({
      fieldErrors: {
        'resources.0.resourceId': ['booking.validation.resource_invalid'],
        'resources.1.resourceId': ['booking.validation.resource_invalid'],
      },
    });
  });

  it('writes nothing when the form is refused, and records what it did when it is not', async () => {
    const before = await db.orm.public.BookableService.where({
      websiteId: String(suite.world.scope.websiteId),
    }).all();
    await harness.commands.createBookableService.execute({
      websiteId: String(suite.world.scope.websiteId),
      ...input({ name: '' }),
      locationId: locationId(),
    });
    const after = await db.orm.public.BookableService.where({
      websiteId: String(suite.world.scope.websiteId),
    }).all();
    expect(after.length).toBe(before.length);

    const created = await createService({ name: 'Audited' });
    expect(harness.events).toContainEqual(
      expect.objectContaining({ type: 'booking.service_created', serviceId: created.id }),
    );
  });
});

describe('changing a service', () => {
  const change = (
    created: Awaited<ReturnType<typeof createService>>,
    overrides: Parameters<typeof input>[0] = {},
    extra: { acknowledgeShared?: boolean } = {},
  ) =>
    harness.commands.updateBookableService.execute({
      websiteId: String(suite.world.scope.websiteId),
      ...input({ ...overrides }),
      locationId: locationId(),
      serviceId: created.id,
      expectedVersion: created.version,
      expectedSettingVersion: created.settingVersion,
      acknowledgeShared: extra.acknowledgeShared ?? false,
    });

  it('refuses a change made from a version somebody else has moved on from, and keeps what is there', async () => {
    const created = await createService({ name: 'Stale one' });
    (await change(created, { name: 'First change' }))._unsafeUnwrap();

    const second = await change(created, { name: 'Second change' });

    expect(second._unsafeUnwrapErr()).toMatchObject({ code: CODES.serviceStale });
    const view = (
      await harness.queries.getService.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: locationId(),
        serviceId: created.id,
      })
    )._unsafeUnwrap();
    expect(view.name).toBe('First change');
  });

  it('changes only this location’s part without bumping the shared version', async () => {
    const created = await createService({ name: 'Local only' });

    const updated = (
      await change(created, { name: 'Local only', isOnlineBookable: false })
    )._unsafeUnwrap();

    expect(updated.isOnlineBookable).toBe(false);
    expect(updated.version).toBe(created.version);
    expect(updated.settingVersion).not.toBe(created.settingVersion);
  });

  it('answers a change that changes nothing with the service as it is, writing nothing', async () => {
    const created = await createService({ name: 'No change' });

    const same = (await change(created, { name: 'No change' }))._unsafeUnwrap();

    expect(same.version).toBe(created.version);
    expect(same.settingVersion).toBe(created.settingVersion);
    expect(harness.events.some((event) => event.type === 'booking.service_updated')).toBe(false);
  });
});

describe('who may administer services', () => {
  it('lets the viewer read services and refuses everything that changes or previews one', async () => {
    const created = await createService({ name: 'Readable' });
    harness.actAs(actorOf(suite.world, 'viewer'));

    const read = await harness.queries.getService.execute({
      websiteId: String(suite.world.scope.websiteId),
      locationId: locationId(),
      serviceId: created.id,
    });
    const refused = [
      await harness.commands.createBookableService.execute({
        websiteId: String(suite.world.scope.websiteId),
        ...input(),
        locationId: locationId(),
      }),
      await harness.queries.getServiceFormOptions.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: locationId(),
      }),
      await harness.queries.listAdoptableServices.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: locationId(),
        page: {},
      }),
      await harness.queries.previewServiceDeactivation.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: locationId(),
        serviceId: created.id,
        scope: 'location',
      }),
    ];

    expect(read.isOk()).toBe(true);
    for (const result of refused) {
      expect(result._unsafeUnwrapErr().code).toBe('auth.permission_denied');
    }
  });

  it.each([null, 'employee', 'contributor'] as const)(
    'refuses %s the whole area and writes nothing',
    async (role) => {
      harness.actAs(role === null ? null : actorOf(suite.world, role));
      const before = await db.orm.public.BookableService.where({
        websiteId: String(suite.world.scope.websiteId),
      }).all();

      const results = [
        await harness.commands.createBookableService.execute({
          websiteId: String(suite.world.scope.websiteId),
          ...input(),
          locationId: locationId(),
        }),
        await harness.queries.listServices.execute({
          websiteId: String(suite.world.scope.websiteId),
          locationId: locationId(),
          page: {},
        }),
      ];

      for (const result of results) {
        expect(['forbidden', 'unauthorized']).toContain(result._unsafeUnwrapErr().kind);
      }
      const after = await db.orm.public.BookableService.where({
        websiteId: String(suite.world.scope.websiteId),
      }).all();
      expect(after.length).toBe(before.length);
    },
  );

  it('does not find a location, or a service, of another website', async () => {
    const created = await createService({ name: 'Mine' });
    harness.actAs(admin());
    const otherSite = String(suite.world.otherScope.websiteId);
    await db.orm.public.BookingLocation.create({
      id: `${otherSite}-loc`,
      tenantId: otherSite,
      websiteId: otherSite,
      name: 'Elsewhere',
      timeZone: 'Europe/Berlin',
      openingHours: { weekly: [], exceptions: [] },
    });

    const foreignLocation = await harness.queries.listServices.execute({
      websiteId: String(suite.world.scope.websiteId),
      locationId: `${otherSite}-loc`,
      page: {},
    });
    const missing = await harness.queries.getService.execute({
      websiteId: String(suite.world.scope.websiteId),
      locationId: locationId(),
      serviceId: 'not-a-service',
    });

    expect(foreignLocation._unsafeUnwrapErr().code).toBe(CODES.locationNotFound);
    expect(missing._unsafeUnwrapErr().code).toBe(CODES.serviceNotFound);
    expect(created.id).toBeDefined();
  });
});
