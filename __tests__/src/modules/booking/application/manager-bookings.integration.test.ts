import { describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth';
import type { Actor } from '@modules/auth';
import { toActorId } from '@modules/auth/domain/models/ids';
import {
  BOOKING_ERROR_CODES as CODES,
  BOOKING_VALIDATION_CODES,
} from '@modules/booking/domain/errors/booking-errors';

import { actorOf } from '../support/application-harness';
import { useStaffSuite } from '../support/staff-suite';

const staff = useStaffSuite();
const { harness, suite, admin, anna, at, created } = staff;

const stranger = (): Actor => ({
  id: toActorId('actor-stranger'),
  tenantId: toTenantId(String(suite.world.otherScope.tenantId)),
  roles: ['admin'],
});

describe('the names a manager labels bookings with', () => {
  it("names the website's locations, services and resources, employees included", async () => {
    const names = (
      await harness.queries.getBookingNames.execute({
        websiteId: String(suite.world.scope.websiteId),
      })
    )._unsafeUnwrap();

    expect(names.locations).toEqual([
      {
        id: String(suite.world.locationId),
        name: 'Rathaus West',
        timeZone: 'Europe/Berlin',
        today: '2027-01-10',
      },
    ]);
    expect(names.services.map((service) => service.name).sort()).toEqual(['Beratung', 'Reisepass']);
    const resources = names.resources.map((resource) => resource.id);
    expect(resources).toEqual(
      expect.arrayContaining([suite.world.ids.anna, suite.world.ids.ben, suite.world.ids.room]),
    );
    expect(resources).not.toContain(suite.world.ids.foreign);
  });

  it("gives another tenant only its own website's names", async () => {
    harness.actAs(stranger());
    const names = (
      await harness.queries.getBookingNames.execute({
        websiteId: String(suite.world.otherScope.websiteId),
      })
    )._unsafeUnwrap();

    expect(names.locations).toEqual([]);
    expect(names.services).toEqual([]);
    expect(names.resources.map((resource) => resource.id)).toEqual([suite.world.ids.foreign]);
  });

  it('refuses nobody and people who may not read the bookings', async () => {
    harness.actAs(null);
    expect(
      (
        await harness.queries.getBookingNames.execute({
          websiteId: String(suite.world.scope.websiteId),
        })
      )._unsafeUnwrapErr().kind,
    ).toBe('forbidden');
    for (const actor of [anna(), actorOf(suite.world, 'contributor')]) {
      harness.actAs(actor);
      expect(
        (
          await harness.queries.getBookingNames.execute({
            websiteId: String(suite.world.scope.websiteId),
          })
        )._unsafeUnwrapErr().code,
      ).toBe('auth.permission_denied');
    }
  });
});

describe('the list and the calendar of a manager', () => {
  const day = '2027-01-14';

  it('counts the states, filters by state and finds a booking by its reference', async () => {
    const open = await created('08:00', day, staff.openServiceId);
    const cancelled = await created('08:30', day, staff.openServiceId);
    const assigned = await created('09:00', day);
    await harness.commands.cancelBooking.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: cancelled.id,
    });

    const all = (
      await harness.queries.listBookings.execute({
        websiteId: String(suite.world.scope.websiteId),
        from: day,
        to: day,
        page: {},
      })
    )._unsafeUnwrap();
    const onlyOpen = (
      await harness.queries.listBookings.execute({
        websiteId: String(suite.world.scope.websiteId),
        from: day,
        to: day,
        state: 'open',
        page: {},
      })
    )._unsafeUnwrap();
    const byReference = (
      await harness.queries.listBookings.execute({
        websiteId: String(suite.world.scope.websiteId),
        from: day,
        to: day,
        reference: ` ${assigned.reference.toLowerCase()} `,
        page: {},
      })
    )._unsafeUnwrap();

    expect(all.days).toEqual({ from: day, to: day });
    expect(all.counts).toMatchObject({ all: 3, open: 1, assigned: 1, cancelled: 1, held: 0 });
    expect(onlyOpen.items.map((item) => item.id)).toEqual([open.id]);
    expect(onlyOpen.counts).toEqual(all.counts);
    expect(byReference.items.map((item) => item.id)).toEqual([assigned.id]);
  });

  it('shows the calendar the same bookings and counts as the list', async () => {
    const list = (
      await harness.queries.listBookings.execute({
        websiteId: String(suite.world.scope.websiteId),
        from: day,
        to: day,
        page: {},
      })
    )._unsafeUnwrap();
    const calendar = (
      await harness.queries.getBookingCalendar.execute({
        websiteId: String(suite.world.scope.websiteId),
        from: day,
        to: day,
      })
    )._unsafeUnwrap();

    expect(calendar.items.map((item) => item.id)).toEqual(list.items.map((item) => item.id));
    expect(calendar.counts).toEqual(list.counts);
    expect(calendar.isTruncated).toBe(false);
    expect(calendar.items[0]?.start).toBe(at('08:00', day));
  });

  it('reads today on the location clock when no day is given', async () => {
    const page = (
      await harness.queries.listBookings.execute({
        websiteId: String(suite.world.scope.websiteId),
        page: {},
      })
    )._unsafeUnwrap();
    expect(page.days).toEqual({ from: '2027-01-10', to: '2027-01-10' });
  });

  it('draws at most six weeks', async () => {
    const error = (
      await harness.queries.getBookingCalendar.execute({
        websiteId: String(suite.world.scope.websiteId),
        from: '2027-01-01',
        to: '2027-02-12',
      })
    )._unsafeUnwrapErr();
    expect(error).toMatchObject({
      kind: 'validation',
      fieldErrors: { to: [BOOKING_VALIDATION_CODES.dateRangeTooLong] },
    });
  });

  it("shows another tenant none of this website's bookings, and employees nothing", async () => {
    harness.actAs(stranger());
    const foreign = (
      await harness.queries.getBookingCalendar.execute({
        websiteId: String(suite.world.otherScope.websiteId),
        from: day,
        to: day,
      })
    )._unsafeUnwrap();
    expect(foreign.items).toEqual([]);
    expect(foreign.counts.all).toBe(0);

    harness.actAs(anna());
    const refused = await harness.queries.getBookingCalendar.execute({
      websiteId: String(suite.world.scope.websiteId),
      from: day,
      to: day,
    });
    expect(refused._unsafeUnwrapErr().code).toBe('auth.permission_denied');
  });
});

describe('the free times a manager books and moves into', () => {
  const day = '2027-01-15';
  const location = () => ({
    serviceId: String(suite.world.serviceId),
    locationId: String(suite.world.locationId),
  });
  const startsOf = async (input: object) =>
    (
      await harness.queries.getStaffSlots.execute({
        websiteId: String(suite.world.scope.websiteId),
        day,
        ...input,
      })
    )
      ._unsafeUnwrap()
      .slots.map((slot) => slot.start);

  it('leaves out a time both employees are taken, except for a booking moved within it', async () => {
    const first = await created('10:00', day);
    await created('10:00', day);

    expect(await startsOf(location())).not.toContain(at('10:00', day));
    expect(await startsOf(location())).toContain(at('10:30', day));
    expect(await startsOf({ bookingId: first.id })).toContain(at('10:00', day));
  });

  it('refuses employees, and treats another tenant’s booking as missing', async () => {
    const booking = await created('11:00', day);
    harness.actAs(anna());
    expect(
      (
        await harness.queries.getStaffSlots.execute({
          websiteId: String(suite.world.scope.websiteId),
          day,
          ...location(),
        })
      )._unsafeUnwrapErr().code,
    ).toBe('auth.permission_denied');

    harness.actAs(stranger());
    const result = await harness.queries.getStaffSlots.execute({
      websiteId: String(suite.world.otherScope.websiteId),
      day,
      bookingId: booking.id,
    });
    expect(result._unsafeUnwrapErr().code).toBe(CODES.bookingNotFound);
    harness.actAs(admin());
  });
});
