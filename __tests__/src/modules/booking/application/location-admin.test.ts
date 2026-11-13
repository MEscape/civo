import { beforeEach, describe, expect, it } from 'vitest';

import { CreateBookingLocation } from '@modules/booking/application/commands/create-booking-location';
import { UpdateBookingLocation } from '@modules/booking/application/commands/update-booking-location';
import type {
  UpdateLocationInput,
  LocationInput,
} from '@modules/booking/application/contracts/location-inputs';
import type { LocationView } from '@modules/booking/application/contracts/location-views';
import { GetLocation } from '@modules/booking/application/queries/get-location';
import { ListLocations } from '@modules/booking/application/queries/list-locations';
import { PreviewLocationChange } from '@modules/booking/application/queries/preview-location-change';
import { BOOKING_ERROR_CODES as ERRORS } from '@modules/booking/domain/errors/booking-errors';
import { toBookingLocationId } from '@modules/booking/domain/models/ids';

import type { AppResultAsync } from '@lib/result';

import {
  OTHER_TENANT,
  actorOf,
  createLocationWorld,
  storedBooking,
} from '../support/location-fakes';
import { CLOSED, locationInput, officeDay, officeWeek } from '../support/location-inputs';
import { at } from '../support/time-fixtures';

import type { LocationWorld } from '../support/location-fakes';

function setup() {
  const world = createLocationWorld();
  return {
    world,
    create: new CreateBookingLocation(world.deps),
    update: new UpdateBookingLocation(world.deps),
    list: new ListLocations(world.deps),
    get: new GetLocation(world.deps),
    preview: new PreviewLocationChange(world.deps),
  };
}

async function created(
  { world, create }: ReturnType<typeof setup>,
  input: LocationInput = locationInput(),
): Promise<LocationView> {
  const result = await create.execute({ websiteId: 'tenant-1', ...input });
  if (result.isErr()) {
    throw new Error(`could not create the location: ${result.error.code}`);
  }
  world.events.length = 0;
  return result.value;
}

function change(
  view: LocationView,
  input: LocationInput,
  acknowledgeImpact = false,
): UpdateLocationInput {
  return {
    ...input,
    websiteId: 'tenant-1',
    locationId: view.id,
    expectedVersion: view.version,
    acknowledgeImpact,
  };
}

/** The error code a use case answered with. */
async function codeOf(pending: AppResultAsync<unknown>) {
  const result = await pending;
  return result.isErr() ? result.error.code : 'ok';
}

const FRIDAY = '2027-01-15';

/** Three bookings on Friday afternoon, at 14:30, 15:00 and 15:30: inside the hours until 16:00. */
function fridayAfternoon(locationId: string) {
  const id = toBookingLocationId(locationId);
  return [
    storedBooking('b-1430', id, at(FRIDAY, '14:30'), at(FRIDAY, '15:00')),
    storedBooking('b-1500', id, at(FRIDAY, '15:00'), at(FRIDAY, '15:30')),
    storedBooking('b-1530', id, at(FRIDAY, '15:30'), at(FRIDAY, '16:00')),
  ];
}

const fridayUntil14 = (extra: Partial<LocationInput> = {}) =>
  locationInput({
    openingHours: { weekly: officeWeek({ 4: officeDay('14:00') }), exceptions: [] },
    ...extra,
  });

describe('who may do what', () => {
  it.each(['viewer', 'employee', 'contributor'] as const)(
    '%s cannot create or change a location, and nothing is stored',
    async (role) => {
      const s = setup();
      const view = await created(s);
      s.world.actAs(actorOf(role));

      expect(
        await codeOf(
          s.create.execute({ websiteId: 'tenant-1', ...locationInput({ name: 'Neu' }) }),
        ),
      ).toBe('auth.permission_denied');
      expect(await codeOf(s.update.execute(change(view, locationInput({ name: 'Anders' }))))).toBe(
        'auth.permission_denied',
      );
      expect(
        await codeOf(
          s.preview.execute({
            websiteId: 'tenant-1',
            locationId: view.id,
            location: locationInput(),
          }),
        ),
      ).toBe('auth.permission_denied');
      expect([...s.world.locations.rows.values()].map(({ name }) => name)).toEqual([
        'Bürgerbüro Mitte',
      ]);
      expect(s.world.events).toEqual([]);
    },
  );

  it('lets a viewer read, and an employee not even that', async () => {
    const s = setup();
    const view = await created(s);

    s.world.actAs(actorOf('viewer'));
    expect((await s.list.execute({ websiteId: 'tenant-1', page: {} })).isOk()).toBe(true);
    expect((await s.get.execute({ websiteId: 'tenant-1', locationId: view.id })).isOk()).toBe(true);

    s.world.actAs(actorOf('employee'));
    expect(await codeOf(s.list.execute({ websiteId: 'tenant-1', page: {} }))).toBe(
      'auth.permission_denied',
    );
    expect(await codeOf(s.get.execute({ websiteId: 'tenant-1', locationId: view.id }))).toBe(
      'auth.permission_denied',
    );
  });

  it('refuses nobody signed in', async () => {
    const s = setup();
    s.world.actAs(null);

    expect(await codeOf(s.create.execute({ websiteId: 'tenant-1', ...locationInput() }))).toBe(
      'auth.permission_denied',
    );
    expect(await codeOf(s.list.execute({ websiteId: 'tenant-1', page: {} }))).toBe(
      'auth.permission_denied',
    );
  });

  it('refuses someone who is no member of the website, and changes nothing', async () => {
    const s = setup();
    const view = await created(s);
    s.world.actAs(actorOf('admin', OTHER_TENANT));

    expect(await codeOf(s.get.execute({ websiteId: 'tenant-1', locationId: view.id }))).toBe(
      'auth.permission_denied',
    );
    expect(await codeOf(s.update.execute(change(view, locationInput({ name: 'Mein' }))))).toBe(
      'auth.permission_denied',
    );
    expect(
      await codeOf(
        s.preview.execute({
          websiteId: 'tenant-1',
          locationId: view.id,
          location: locationInput(),
        }),
      ),
    ).toBe('auth.permission_denied');
    s.world.actAs(actorOf('admin'));
    const own = await s.list.execute({ websiteId: 'tenant-1', page: {} });
    expect(own.isOk() && own.value.total).toBe(1);
    expect([...s.world.locations.rows.values()][0]?.name).toBe('Bürgerbüro Mitte');
  });

  it('does not show the location of another website to someone who is a member of both', async () => {
    const s = setup();
    const view = await created(s);

    expect(await codeOf(s.get.execute({ websiteId: 'tenant-1', locationId: 'elsewhere' }))).toBe(
      ERRORS.locationNotFound,
    );
    expect(view.websiteId).toBe('tenant-1');
  });

  it('stops a manager who has used up the budget for changes', async () => {
    const s = setup();
    s.world.limitTo(0);

    expect(await codeOf(s.create.execute({ websiteId: 'tenant-1', ...locationInput() }))).toBe(
      ERRORS.rateLimited,
    );
    expect(s.world.locations.rows.size).toBe(0);
    expect(s.world.enforced).toEqual(['booking.staff-actor']);
  });
});

describe('creating a location', () => {
  it('stores it for the manager website, answers the form shape, and audits who did it', async () => {
    const s = setup();
    const result = await s.create.execute({
      websiteId: 'tenant-1',
      ...locationInput({ address: '' }),
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }
    expect(result.value).toMatchObject({
      name: 'Bürgerbüro Mitte',
      address: null,
      timeZone: 'Europe/Berlin',
      isActive: true,
      futureBookingCount: 0,
    });
    expect(result.value.weekly).toHaveLength(7);
    expect(result.value.weekly[4]?.intervals).toEqual([{ start: '08:00', end: '16:00' }]);
    expect(result.value.weekly[5]).toEqual(CLOSED);
    expect(s.world.events).toEqual([
      expect.objectContaining({ type: 'booking.location_created', locationId: result.value.id }),
    ]);
  });

  it('refuses invalid hours with the fields at fault and stores nothing', async () => {
    const s = setup();
    const result = await s.create.execute({
      websiteId: 'tenant-1',
      ...locationInput({
        name: '',
        openingHours: {
          weekly: officeWeek({ 0: { intervals: [{ start: '18:00', end: '08:00' }], breaks: [] } }),
          exceptions: [],
        },
      }),
    });

    expect(
      result.isErr() &&
        result.error.kind === 'validation' &&
        Object.keys(result.error.fieldErrors).sort(),
    ).toEqual(['name', 'openingHours.weekly.0.intervals.0.end']);
    expect(s.world.locations.rows.size).toBe(0);
    expect(s.world.events).toEqual([]);
  });
});

describe('listing locations', () => {
  async function three(s: ReturnType<typeof setup>) {
    await created(s, locationInput({ name: 'Bürgerbüro West' }));
    await created(s, locationInput({ name: 'Bürgerbüro Nord', isActive: false }));
    await created(s, locationInput({ name: 'Standesamt' }));
  }

  it('filters by name in any case and by state, and counts what matches', async () => {
    const s = setup();
    await three(s);

    const search = await s.list.execute({
      websiteId: 'tenant-1',
      search: ' BÜRGERBÜRO ',
      page: {},
    });
    const inactive = await s.list.execute({ websiteId: 'tenant-1', isActive: false, page: {} });
    const active = await s.list.execute({ websiteId: 'tenant-1', isActive: true, page: {} });

    expect(search.isOk() && search.value.items.map(({ name }) => name)).toEqual([
      'Bürgerbüro Nord',
      'Bürgerbüro West',
    ]);
    expect(inactive.isOk() && inactive.value.items.map(({ name }) => name)).toEqual([
      'Bürgerbüro Nord',
    ]);
    expect(active.isOk() && active.value.total).toBe(2);
  });

  it('pages, and answers the last page when the one asked for is past the end', async () => {
    const s = setup();
    await three(s);

    const second = await s.list.execute({ websiteId: 'tenant-1', page: { page: 2, pageSize: 2 } });
    const past = await s.list.execute({ websiteId: 'tenant-1', page: { page: 9, pageSize: 2 } });

    expect(second.isOk() && second.value).toMatchObject({
      page: 2,
      pageSize: 2,
      total: 3,
      pageCount: 2,
    });
    expect(second.isOk() && second.value.items.map(({ name }) => name)).toEqual(['Standesamt']);
    expect(past.isOk() && past.value.page).toBe(2);
  });

  it('says when each location is open today on its own clock, not the server one', async () => {
    const s = setup();
    // Monday 00:30 in Berlin is still Sunday 18:30 in New York.
    s.world.setNow(at('2027-01-11', '00:30'));
    await created(s, locationInput({ name: 'Berlin' }));
    await created(
      s,
      locationInput({
        name: 'New York',
        timeZone: 'America/New_York',
        openingHours: { weekly: officeWeek({ 6: officeDay('17:00') }), exceptions: [] },
      }),
    );

    const page = await s.list.execute({ websiteId: 'tenant-1', page: {} });

    const [berlin, newYork] = page.isOk() ? page.value.items : [];
    expect(berlin?.todayWindows).toEqual([
      { start: '2027-01-11T08:00:00+01:00', end: '2027-01-11T12:00:00+01:00' },
      { start: '2027-01-11T13:00:00+01:00', end: '2027-01-11T18:00:00+01:00' },
    ]);
    expect(newYork?.todayWindows).toEqual([
      { start: '2027-01-10T08:00:00-05:00', end: '2027-01-10T12:00:00-05:00' },
      { start: '2027-01-10T13:00:00-05:00', end: '2027-01-10T17:00:00-05:00' },
    ]);
  });

  it('answers an empty list for a location that is closed today', async () => {
    const s = setup();
    s.world.setNow(at('2027-01-16', '10:00'));
    await created(s);

    const page = await s.list.execute({ websiteId: 'tenant-1', page: {} });

    expect(page.isOk() && page.value.items[0]?.todayWindows).toEqual([]);
  });

  it('applies an exception to today: a closure empties it, other hours replace it', async () => {
    const s = setup();
    s.world.setNow(at(FRIDAY, '09:00'));
    await created(
      s,
      locationInput({
        name: 'Mit Ausnahme',
        openingHours: {
          weekly: officeWeek(),
          exceptions: [
            {
              kind: 'override',
              from: FRIDAY,
              to: FRIDAY,
              day: { intervals: [{ start: '09:00', end: '11:00' }], breaks: [] },
            },
          ],
        },
      }),
    );
    await created(
      s,
      locationInput({
        name: 'Geschlossen',
        openingHours: {
          weekly: officeWeek(),
          exceptions: [{ kind: 'closed', from: FRIDAY, to: FRIDAY }],
        },
      }),
    );

    const page = await s.list.execute({ websiteId: 'tenant-1', page: {} });

    const [closed, override] = page.isOk() ? page.value.items : [];
    expect(closed?.name).toBe('Geschlossen');
    expect(closed?.todayWindows).toEqual([]);
    expect(override?.todayWindows).toEqual([
      { start: '2027-01-15T09:00:00+01:00', end: '2027-01-15T11:00:00+01:00' },
    ]);
  });

  it.each([
    ['2026-03-29', '2026-03-29T00:00:00+01:00', '2026-03-29T08:00:00+02:00'],
    ['2026-10-25', '2026-10-25T00:00:00+02:00', '2026-10-25T08:00:00+01:00'],
  ])(
    'reads the hours of the day the clocks change (%s) on the clock the people there see',
    async (date, start, end) => {
      const s = setup();
      s.world.setNow(at(date, '12:00'));
      // Both clock changes of 2026 are on a Sunday.
      await created(
        s,
        locationInput({
          openingHours: {
            weekly: officeWeek({
              6: { intervals: [{ start: '00:00', end: '08:00' }], breaks: [] },
            }),
            exceptions: [],
          },
        }),
      );

      const page = await s.list.execute({ websiteId: 'tenant-1', page: {} });

      expect(page.isOk() && page.value.items[0]?.todayWindows).toEqual([{ start, end }]);
    },
  );
});

describe('reading one location', () => {
  it('answers the form shape, the version and the confirmed bookings ahead', async () => {
    const s = setup();
    const view = await created(s);
    s.world.setBookings(fridayAfternoon(view.id));

    const result = await s.get.execute({ websiteId: 'tenant-1', locationId: view.id });

    expect(result.isOk() && result.value).toMatchObject({
      id: view.id,
      version: view.version,
      futureBookingCount: 3,
    });
  });

  it('names a holiday on a one-day exception and leaves other exceptions unnamed', async () => {
    const s = setup();
    const view = await created(
      s,
      locationInput({
        openingHours: {
          weekly: officeWeek(),
          exceptions: [
            { kind: 'closed', from: '2027-03-26', to: '2027-03-26' },
            { kind: 'closed', from: '2027-06-12', to: '2027-06-12' },
            { kind: 'closed', from: '2027-03-26', to: '2027-03-28' },
          ],
        },
      }),
    );

    expect(view.exceptions.map(({ from, holiday }) => `${from}:${holiday}`)).toEqual([
      '2027-03-26:goodFriday',
      '2027-03-26:null',
      '2027-06-12:null',
    ]);
    expect(view.exceptions[0]?.day).toBeNull();
  });

  it('refuses an id that is not one, and one that does not exist', async () => {
    const s = setup();

    expect(await codeOf(s.get.execute({ websiteId: 'tenant-1', locationId: '' }))).toBe(
      ERRORS.validationFailed,
    );
    expect(await codeOf(s.get.execute({ websiteId: 'tenant-1', locationId: 'nowhere' }))).toBe(
      ERRORS.locationNotFound,
    );
  });
});

describe('what a change of hours would affect', () => {
  it('names the bookings the new hours leave outside, and only those', async () => {
    const s = setup();
    const view = await created(s);
    s.world.setBookings([
      ...fridayAfternoon(view.id),
      storedBooking(
        'b-morning',
        toBookingLocationId(view.id),
        at(FRIDAY, '09:00'),
        at(FRIDAY, '09:30'),
      ),
      storedBooking(
        'b-elsewhere',
        toBookingLocationId('another'),
        at(FRIDAY, '15:00'),
        at(FRIDAY, '15:30'),
      ),
    ]);

    const result = await s.preview.execute({
      websiteId: 'tenant-1',
      locationId: view.id,
      location: fridayUntil14(),
    });

    expect(result.isOk() && result.value.isTruncated).toBe(false);
    expect(
      result.isOk() &&
        result.value.affected.map(
          ({ bookingId, start, reason }) => `${bookingId} ${start} ${reason}`,
        ),
    ).toEqual([
      'b-1430 2027-01-15T14:30:00+01:00 outside-opening-hours',
      'b-1500 2027-01-15T15:00:00+01:00 outside-opening-hours',
      'b-1530 2027-01-15T15:30:00+01:00 outside-opening-hours',
    ]);
  });

  it('does not blame the change for a booking that already sat outside the hours', async () => {
    const s = setup();
    const view = await created(s);
    s.world.setBookings([
      storedBooking(
        'b-saturday',
        toBookingLocationId(view.id),
        at('2027-01-16', '10:00'),
        at('2027-01-16', '10:30'),
      ),
    ]);

    const result = await s.preview.execute({
      websiteId: 'tenant-1',
      locationId: view.id,
      location: fridayUntil14(),
    });

    expect(result.isOk() && result.value.affected).toEqual([]);
  });

  it('finds nobody when the hours do not change, or only grow', async () => {
    const s = setup();
    const view = await created(s);
    s.world.setBookings(fridayAfternoon(view.id));

    const same = await s.preview.execute({
      websiteId: 'tenant-1',
      locationId: view.id,
      location: locationInput(),
    });
    const longer = await s.preview.execute({
      websiteId: 'tenant-1',
      locationId: view.id,
      location: locationInput({
        openingHours: { weekly: officeWeek({ 4: officeDay('18:00') }), exceptions: [] },
      }),
    });

    expect(same.isOk() && same.value.affected).toEqual([]);
    expect(longer.isOk() && longer.value.affected).toEqual([]);
  });

  it('counts a closure on that day, and a break over a booking', async () => {
    const s = setup();
    const view = await created(s);
    s.world.setBookings([
      storedBooking(
        'b-noon',
        toBookingLocationId(view.id),
        at('2027-01-12', '12:15'),
        at('2027-01-12', '12:45'),
      ),
      ...fridayAfternoon(view.id),
    ]);

    const result = await s.preview.execute({
      websiteId: 'tenant-1',
      locationId: view.id,
      location: locationInput({
        openingHours: {
          weekly: officeWeek({
            1: {
              intervals: [{ start: '08:00', end: '18:00' }],
              breaks: [{ start: '12:00', end: '13:00' }],
            },
          }),
          exceptions: [{ kind: 'closed', from: FRIDAY, to: FRIDAY }],
        },
      }),
    });

    // The break at noon was already there; the closure takes the three bookings of Friday.
    expect(result.isOk() && result.value.affected.map(({ bookingId }) => bookingId)).toEqual([
      'b-1430',
      'b-1500',
      'b-1530',
    ]);
  });

  it('says when the answer is incomplete', async () => {
    const s = setup();
    const view = await created(s);
    const id = toBookingLocationId(view.id);
    s.world.setBookings(
      Array.from({ length: 501 }, (_unused, index) =>
        storedBooking(`b-${index}`, id, at(FRIDAY, '09:00'), at(FRIDAY, '09:30')),
      ),
    );

    const result = await s.preview.execute({
      websiteId: 'tenant-1',
      locationId: view.id,
      location: locationInput(),
    });

    expect(result.isOk() && result.value.isTruncated).toBe(true);
    expect(result.isOk() && result.value.affected).toEqual([]);
  });
});

describe('changing a location', () => {
  let s: ReturnType<typeof setup>;
  let view: LocationView;
  let world: LocationWorld;

  beforeEach(async () => {
    s = setup();
    world = s.world;
    view = await created(s);
  });

  it('saves details, answers the new version, and audits which part changed', async () => {
    const result = await s.update.execute(
      change(view, locationInput({ name: 'Bürgerbüro Zentrum', address: 'Neue Straße 2' })),
    );

    expect(result.isOk() && result.value).toMatchObject({
      name: 'Bürgerbüro Zentrum',
      address: 'Neue Straße 2',
    });
    expect(result.isOk() && result.value.version).not.toBe(view.version);
    expect(world.events).toEqual([
      expect.objectContaining({
        type: 'booking.location_updated',
        sections: ['details'],
        leftOpen: 0,
      }),
    ]);
  });

  it('refuses a change made from an old version, and keeps what the other manager saved', async () => {
    await s.update.execute(change(view, locationInput({ name: 'Erste Änderung' })));

    const second = await codeOf(
      s.update.execute(change(view, locationInput({ name: 'Zweite Änderung' }))),
    );

    expect(second).toBe(ERRORS.locationStale);
    expect([...world.locations.rows.values()][0]?.name).toBe('Erste Änderung');
  });

  it('lets the next change name the version the last one answered', async () => {
    const first = await s.update.execute(change(view, locationInput({ name: 'A' })));
    const next = first.isOk() ? first.value : view;

    expect((await s.update.execute(change(next, locationInput({ name: 'B' })))).isOk()).toBe(true);
  });

  it('refuses a version that is not one', async () => {
    const result = await s.update.execute({
      ...change(view, locationInput()),
      expectedVersion: 'yesterday',
    });

    expect(
      result.isErr() && result.error.kind === 'validation' && result.error.fieldErrors,
    ).toEqual({
      expectedVersion: [expect.any(String)],
    });
  });

  it('saves new hours that affect nobody without asking', async () => {
    const result = await s.update.execute(change(view, fridayUntil14()));

    expect(result.isOk() && result.value.weekly[4]?.intervals).toEqual([
      { start: '08:00', end: '14:00' },
    ]);
    expect(world.events).toEqual([expect.objectContaining({ sections: ['hours'], leftOpen: 0 })]);
  });

  describe('hours that leave bookings outside', () => {
    beforeEach(() => {
      world.setBookings(fridayAfternoon(view.id));
    });

    it('are refused until the manager has seen them, and nothing is saved', async () => {
      const code = await codeOf(s.update.execute(change(view, fridayUntil14())));

      expect(code).toBe(ERRORS.locationImpactUnacknowledged);
      expect([...world.locations.rows.values()][0]?.openingHours.weekly[5].ranges).toEqual([
        { startMinute: 480, endMinute: 960 },
      ]);
      expect(world.events).toEqual([]);
    });

    it('are saved once the manager lets the bookings stand, and no booking is touched', async () => {
      const before = await s.get.execute({ websiteId: 'tenant-1', locationId: view.id });

      const result = await s.update.execute(change(view, fridayUntil14(), true));

      expect(result.isOk()).toBe(true);
      // The use case cannot write a booking (its dependencies hold no write), and the same
      // three are still there, still counted, for the next look.
      expect(result.isOk() && result.value.futureBookingCount).toBe(3);
      expect(before.isOk() && before.value.futureBookingCount).toBe(3);
      expect(world.events).toEqual([expect.objectContaining({ sections: ['hours'], leftOpen: 3 })]);
      const preview = await s.preview.execute({
        websiteId: 'tenant-1',
        locationId: view.id,
        location: fridayUntil14(),
      });
      expect(preview.isOk() && preview.value.affected).toEqual([]);
    });

    it('are refused when the list of bookings is cut, because the rest is unknown', async () => {
      const id = toBookingLocationId(view.id);
      world.setBookings(
        Array.from({ length: 501 }, (_unused, index) =>
          storedBooking(`b-${index}`, id, at(FRIDAY, '09:00'), at(FRIDAY, '09:30')),
        ),
      );

      expect(await codeOf(s.update.execute(change(view, fridayUntil14())))).toBe(
        ERRORS.locationImpactUnacknowledged,
      );
    });
  });

  describe('the time zone', () => {
    const inNewYork = () => locationInput({ timeZone: 'America/New_York' });

    it('cannot change while confirmed bookings are ahead', async () => {
      world.setBookings(fridayAfternoon(view.id));

      expect(await codeOf(s.update.execute(change(view, inNewYork(), true)))).toBe(
        ERRORS.timeZoneLocked,
      );
      expect([...world.locations.rows.values()][0]?.zone).toBe('Europe/Berlin');
    });

    it('can change when there are none, or only bookings that are over', async () => {
      world.setNow(at('2027-02-01', '09:00'));
      world.setBookings(fridayAfternoon(view.id));

      const result = await s.update.execute(change(view, inNewYork()));

      expect(result.isOk() && result.value.timeZone).toBe('America/New_York');
      expect(world.events).toEqual([expect.objectContaining({ sections: ['details'] })]);
    });

    it('is not blocked by the bookings of another location', async () => {
      world.setBookings(fridayAfternoon('another-location'));

      expect((await s.update.execute(change(view, inNewYork()))).isOk()).toBe(true);
    });
  });

  it('switches a location off without touching, or asking about, its bookings', async () => {
    world.setBookings(fridayAfternoon(view.id));

    const result = await s.update.execute(change(view, locationInput({ isActive: false })));

    expect(result.isOk() && result.value).toMatchObject({ isActive: false, futureBookingCount: 3 });
    expect(world.events).toEqual([expect.objectContaining({ sections: ['status'], leftOpen: 0 })]);
  });

  it('refuses invalid input before it reads anything', async () => {
    const code = await codeOf(
      s.update.execute(change(view, locationInput({ timeZone: 'nowhere' }))),
    );

    expect(code).toBe(ERRORS.validationFailed);
    expect(world.events).toEqual([]);
  });
});
