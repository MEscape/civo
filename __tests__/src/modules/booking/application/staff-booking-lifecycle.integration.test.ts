import { describe, expect, it } from 'vitest';

import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';

import { actorOf } from '../support/application-harness';
import { useStaffSuite } from '../support/staff-suite';

const staff = useStaffSuite();
const { harness, suite, admin, anna, ben, at, create, created, rowsOf } = staff;

describe('creating for a customer', () => {
  it('books, assigns an employee on its own and tells the customer after the commit', async () => {
    const booking = await created('11:00', '2027-01-12');

    expect(booking.status).toBe('confirmed');
    expect(booking.assignment).toBe('assigned');
    expect(booking.units).toHaveLength(1);
    expect([suite.world.ids.anna, suite.world.ids.ben]).toContain(booking.units[0]?.resourceId);
    expect(harness.notices.map((n) => n.kind)).toEqual(['confirmed']);
    expect(harness.events.map((e) => e.type)).toEqual(['booking.confirmed']);
    expect(harness.events[0]).toMatchObject({ actorId: admin().id });
  });

  it('turns a retry with the same request key into the same booking', async () => {
    const before = await rowsOf();
    const first = (await create('11:30', '2027-01-12', { requestKey: 'try-1' }))._unsafeUnwrap();
    // The same attempt again: the customer's details are those of the first call, so use them.
    const again = await harness.commands.createBookingAsStaff.execute({
      websiteId: String(suite.world.scope.websiteId),
      serviceId: String(suite.world.serviceId),
      locationId: String(suite.world.locationId),
      start: at('11:30', '2027-01-12'),
      customer: first.customer ?? {},
      requestKey: 'try-1',
    });

    expect(again._unsafeUnwrap().id).toBe(first.id);
    expect(await rowsOf()).toBe(before + 1);
    expect(harness.notices).toHaveLength(1);
  });

  it('refuses the same request key for another time instead of answering with the first booking', async () => {
    (await create('15:00', '2027-01-12', { requestKey: 'moved-key' }))._unsafeUnwrap();

    const again = (
      await create('15:30', '2027-01-12', { requestKey: 'moved-key' })
    )._unsafeUnwrapErr();

    expect(again.code).toBe('booking.reference_taken');
  });

  it("does not let a request key reach into another person's booking", async () => {
    const mine = (
      await create('13:00', '2027-01-12', { requestKey: 'shared-key' })
    )._unsafeUnwrap();
    harness.actAs(actorOf(suite.world, 'editor'));

    const theirs = (
      await create('13:30', '2027-01-12', { requestKey: 'shared-key' })
    )._unsafeUnwrap();

    expect(theirs.id).not.toBe(mine.id);
  });

  it('refuses a time outside the opening hours as a conflict, not a crash', async () => {
    const error = (await create('20:00', '2027-01-12'))._unsafeUnwrapErr();
    expect(error.kind).toBe('conflict');
    expect(error.code).toBe(CODES.slotUnavailable);
  });

  it('lets exactly as many bookings through as there are employees when they race', async () => {
    const before = await rowsOf();
    const results = await Promise.all([
      create('14:00', '2027-01-12'),
      create('14:00', '2027-01-12'),
      create('14:00', '2027-01-12'),
    ]);

    expect(results.filter((r) => r.isOk())).toHaveLength(2);
    const lost = results.flatMap((r) => (r.isErr() ? [r.error] : []));
    expect(lost).toHaveLength(1);
    expect(lost[0]?.kind).toBe('conflict');
    expect(await rowsOf()).toBe(before + 2);
    const taken = new Set(
      results.flatMap((r) => (r.isOk() ? r.value.units.map((u) => u.resourceId) : [])),
    );
    expect(taken.size).toBe(2);
  });

  it('spends the manager budget and stops before writing when it is used up', async () => {
    harness.limitTo(0);
    const before = await rowsOf();

    const error = (await create('14:30', '2027-01-12'))._unsafeUnwrapErr();

    expect(error.kind).toBe('rate_limited');
    expect(await rowsOf()).toBe(before);
    expect(harness.enforced).toEqual(['booking.staff-actor']);
  });
});

describe('cancelling and moving', () => {
  it('cancels, says so to the customer and records who did it', async () => {
    const booking = await created('15:00', '2027-01-12');
    harness.notices.length = 0;
    harness.events.length = 0;

    const cancelled = (
      await harness.commands.cancelBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
      })
    )._unsafeUnwrap();

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelledAt).not.toBeNull();
    expect(harness.notices.map((n) => n.kind)).toEqual(['cancelled']);
    expect(harness.events).toMatchObject([{ type: 'booking.cancelled', by: 'manager' }]);
  });

  it('frees the time of a cancelled booking for the next one', async () => {
    const a = await created('15:30', '2027-01-12');
    await created('15:30', '2027-01-12');
    expect((await create('15:30', '2027-01-12'))._unsafeUnwrapErr().kind).toBe('conflict');

    await harness.commands.cancelBooking.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: a.id,
    });

    expect((await create('15:30', '2027-01-12')).isOk()).toBe(true);
  });

  it('does not cancel twice', async () => {
    const booking = await created('16:00', '2027-01-12');
    await harness.commands.cancelBooking.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: booking.id,
    });
    harness.notices.length = 0;

    const again = await harness.commands.cancelBooking.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: booking.id,
    });

    expect(again._unsafeUnwrapErr().code).toBe(CODES.invalidStateTransition);
    expect(harness.notices).toHaveLength(0);
  });

  it('moves a booking, keeps its employee when still free, and does not count it against the citizen', async () => {
    const booking = await created('08:00', '2027-01-13');

    const moved = (
      await harness.commands.rescheduleBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
        start: at('09:00', '2027-01-13'),
      })
    )._unsafeUnwrap();

    expect(moved.start).toContain('T09:00');
    expect(moved.rescheduleCount).toBe(0);
    expect(moved.units).toEqual(booking.units);
    expect(harness.notices.map((n) => n.kind)).toEqual(['confirmed', 'rescheduled']);
  });

  it('leaves a booking untouched when the new time is full', async () => {
    await created('10:00', '2027-01-13');
    await created('10:00', '2027-01-13');
    const booking = await created('11:00', '2027-01-13');
    harness.notices.length = 0;

    const error = (
      await harness.commands.rescheduleBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
        start: at('10:00', '2027-01-13'),
      })
    )._unsafeUnwrapErr();

    expect(error.kind).toBe('conflict');
    const after = (
      await harness.queries.getBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
      })
    )._unsafeUnwrap();
    expect(after.start).toBe(booking.start);
    expect(after.rescheduleCount).toBe(0);
    expect(harness.notices).toHaveLength(0);
  });
});

describe('reading', () => {
  it('shows a manager the customer and an employee only what they serve, without the customer', async () => {
    const booking = await created('13:00', '2027-01-13');
    const servedBy = booking.units[0]?.resourceId === suite.world.ids.anna ? anna() : ben();
    const other = servedBy.id === anna().id ? ben() : anna();

    const asManager = (
      await harness.queries.getBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
      })
    )._unsafeUnwrap();
    expect(asManager.customer).not.toBeNull();

    harness.actAs(servedBy);
    const asServer = (
      await harness.queries.getBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
      })
    )._unsafeUnwrap();
    expect(asServer.customer).toBeNull();

    harness.actAs(other);
    const asOther = await harness.queries.getBooking.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: booking.id,
    });
    expect(asOther._unsafeUnwrapErr().code).toBe(CODES.bookingNotFound);
  });

  it('pages the manager list and filters by status', async () => {
    const booking = await created('13:30', '2027-01-13');
    await harness.commands.cancelBooking.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: booking.id,
    });

    const range = { from: '2027-01-13', to: '2027-01-13' };
    const cancelled = (
      await harness.queries.listBookings.execute({
        websiteId: String(suite.world.scope.websiteId),
        ...range,
        state: 'cancelled',
        page: {},
      })
    )._unsafeUnwrap();
    const tiny = (
      await harness.queries.listBookings.execute({
        websiteId: String(suite.world.scope.websiteId),
        ...range,
        page: { page: 1, pageSize: 1 },
      })
    )._unsafeUnwrap();

    expect(cancelled.items.map((i) => i.id)).toContain(booking.id);
    expect(cancelled.items.every((i) => i.status === 'cancelled')).toBe(true);
    expect(tiny.items).toHaveLength(1);
    expect(tiny.total).toBeGreaterThan(1);
  });

  it('refuses a span that is not a span', async () => {
    const error = (
      await harness.queries.listBookings.execute({
        websiteId: String(suite.world.scope.websiteId),
        from: '2027-01-14',
        to: '2027-01-13',
        page: {},
      })
    )._unsafeUnwrapErr();
    expect(error.kind).toBe('validation');
  });
});
