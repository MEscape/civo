import { describe, expect, it } from 'vitest';

import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';

import { createHarness } from '../support/application-harness';
import { useStaffSuite } from '../support/staff-suite';

const staff = useStaffSuite();
const { harness, suite, anna, ben, created } = staff;

describe('open bookings and who takes them', () => {
  it('leaves the unit open when the service is claimed by employees', async () => {
    const booking = await created('08:00', '2027-01-14', staff.openServiceId);
    expect(booking.assignment).toBe('open');
    expect(booking.units[0]?.resourceId).toBeNull();
  });

  it('offers it to an employee without the customer, and lets them take it', async () => {
    const booking = await created('08:30', '2027-01-14', staff.openServiceId);
    harness.actAs(anna());
    harness.events.length = 0;

    const open = (
      await harness.queries.getOpenBookings.execute({
        websiteId: String(suite.world.scope.websiteId),
      })
    )._unsafeUnwrap();
    const offered = open.find((o) => o.booking.id === booking.id);
    expect(offered).toBeDefined();
    expect(offered).not.toHaveProperty('booking.customer');

    const claimed = (
      await harness.commands.claimBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
      })
    )._unsafeUnwrap();
    expect(claimed.assignment).toBe('assigned');
    expect(claimed.units[0]?.resourceId).toBe(suite.world.ids.anna);
    expect(harness.events).toMatchObject([{ type: 'booking.assigned', how: 'claim' }]);
  });

  it('answers a repeated claim with the same booking and does not write again', async () => {
    const booking = await created('09:00', '2027-01-14', staff.openServiceId);
    harness.actAs(anna());
    await harness.commands.claimBooking.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: booking.id,
    });
    harness.events.length = 0;

    const again = (
      await harness.commands.claimBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
      })
    )._unsafeUnwrap();

    expect(again.units[0]?.resourceId).toBe(suite.world.ids.anna);
    expect(harness.events).toHaveLength(0);
  });

  it('tells the second employee that it is taken', async () => {
    const booking = await created('09:30', '2027-01-14', staff.openServiceId);
    harness.actAs(anna());
    await harness.commands.claimBooking.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: booking.id,
    });

    harness.actAs(ben());
    const error = (
      await harness.commands.claimBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
      })
    )._unsafeUnwrapErr();

    expect(error.code).toBe(CODES.alreadyAssigned);
  });

  it('lets exactly one of two simultaneous claims win', async () => {
    const booking = await created('10:00', '2027-01-14', staff.openServiceId);
    // Two sessions, one person each, reading the same open booking at the same time.
    const sessions = [createHarness(), createHarness()];
    sessions[0]?.actAs(anna());
    sessions[1]?.actAs(ben());

    const [first, second] = await Promise.all(
      sessions.map((session) =>
        session.commands.claimBooking.execute({
          websiteId: String(suite.world.scope.websiteId),
          bookingId: booking.id,
        }),
      ),
    );

    const results = [first, second];
    expect(results.filter((r) => r?.isOk())).toHaveLength(1);
    const lost = results.find((r) => r?.isErr())?._unsafeUnwrapErr();
    expect(lost?.code).toBe(CODES.alreadyAssigned);
    const final = (
      await harness.queries.getBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
      })
    )._unsafeUnwrap();
    expect(final.units).toHaveLength(1);
    expect(final.units[0]?.resourceId).not.toBeNull();
  });

  it('does not let a manager-assigned service be claimed', async () => {
    const booking = await created('10:30', '2027-01-14');
    harness.actAs(booking.units[0]?.resourceId === suite.world.ids.anna ? ben() : anna());

    const error = (
      await harness.commands.claimBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
      })
    )._unsafeUnwrapErr();

    expect([CODES.notClaimable, CODES.alreadyAssigned]).toContain(error.code);
  });

  it('lets a manager assign, and take the employee off again', async () => {
    const booking = await created('11:00', '2027-01-14', staff.openServiceId);

    const assigned = (
      await harness.commands.assignEmployee.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
        resourceId: suite.world.ids.ben,
      })
    )._unsafeUnwrap();
    expect(assigned.units[0]?.resourceId).toBe(suite.world.ids.ben);

    const unassigned = (
      await harness.commands.unassignEmployee.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
        resourceId: suite.world.ids.ben,
      })
    )._unsafeUnwrap();
    expect(unassigned.assignment).toBe('open');
  });

  it('answers a repeated assignment with the same booking and records nothing', async () => {
    const booking = await created('15:00', '2027-01-14', staff.openServiceId);
    const assign = () =>
      harness.commands.assignEmployee.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
        resourceId: suite.world.ids.ben,
      });
    await assign();
    harness.events.length = 0;

    const again = (await assign())._unsafeUnwrap();

    expect(again.units[0]?.resourceId).toBe(suite.world.ids.ben);
    expect(harness.events).toHaveLength(0);
  });

  it('says the place is taken when another employee is asked for a booking that is full', async () => {
    const booking = await created('15:30', '2027-01-14', staff.openServiceId);
    await harness.commands.assignEmployee.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: booking.id,
      resourceId: suite.world.ids.ben,
    });

    const error = (
      await harness.commands.assignEmployee.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
        resourceId: suite.world.ids.anna,
      })
    )._unsafeUnwrapErr();

    expect(error.code).toBe(CODES.alreadyAssigned);
  });

  it('moves a booking from one employee to another when asked to replace', async () => {
    const booking = await created('16:00', '2027-01-14', staff.openServiceId);
    await harness.commands.assignEmployee.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: booking.id,
      resourceId: suite.world.ids.ben,
    });

    const moved = (
      await harness.commands.assignEmployee.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
        resourceId: suite.world.ids.anna,
        replaces: suite.world.ids.ben,
      })
    )._unsafeUnwrap();

    expect(moved.units.map((unit) => unit.resourceId)).toEqual([suite.world.ids.anna]);
  });

  it('refuses to assign a resource of another website', async () => {
    const booking = await created('11:30', '2027-01-14', staff.openServiceId);

    const error = (
      await harness.commands.assignEmployee.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
        resourceId: suite.world.ids.foreign,
      })
    )._unsafeUnwrapErr();

    expect(error.code).toBe(CODES.resourceNotFound);
  });

  it('refuses to assign an employee who is busy at that time', async () => {
    const first = await created('13:00', '2027-01-14', staff.openServiceId);
    const second = await created('13:00', '2027-01-14', staff.openServiceId);
    await harness.commands.assignEmployee.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: first.id,
      resourceId: suite.world.ids.anna,
    });

    const error = (
      await harness.commands.assignEmployee.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: second.id,
        resourceId: suite.world.ids.anna,
      })
    )._unsafeUnwrapErr();

    expect(error.kind).toBe('conflict');
  });

  it('lets an employee hand a booking back', async () => {
    const booking = await created('13:30', '2027-01-14', staff.openServiceId);
    harness.actAs(ben());
    await harness.commands.claimBooking.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: booking.id,
    });

    const back = (
      await harness.commands.handBackBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
      })
    )._unsafeUnwrap();

    expect(back.assignment).toBe('open');
  });
});
