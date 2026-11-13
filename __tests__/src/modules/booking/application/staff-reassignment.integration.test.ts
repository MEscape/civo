import { describe, expect, it } from 'vitest';

import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';

import { createHarness } from '../support/application-harness';
import { useStaffSuite } from '../support/staff-suite';

/**
 * Who serves a booking after it was made, over the real database: a manager replaces the employee
 * of any confirmed booking that has not begun, an `automatic` one included, in one step; nobody hands
 * a booking back or takes an employee off once it has begun; and what the screens offer is that rule.
 */
const staff = useStaffSuite();
const { harness, suite, at, ben, created } = staff;
const DAY = '2027-01-15';

const otherThan = (resourceId: string | null | undefined) =>
  resourceId === suite.world.ids.anna ? suite.world.ids.ben : suite.world.ids.anna;

const read = async (bookingId: string) =>
  (
    await harness.queries.getBooking.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId,
    })
  )._unsafeUnwrap();

describe('a manager replacing the employee of a booking assigned at booking time', () => {
  it('swaps the employee in one step and records it', async () => {
    const booking = await created('08:00', DAY);
    const before = booking.units[0]?.resourceId ?? null;
    const after = otherThan(before);
    harness.events.length = 0;

    const replaced = (
      await harness.commands.assignEmployee.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
        resourceId: after,
        requirementIndex: 0,
        replaces: before ?? undefined,
      })
    )._unsafeUnwrap();

    expect(replaced.units.map((unit) => unit.resourceId)).toEqual([after]);
    expect(replaced.assignment).toBe('assigned');
    expect(harness.events).toMatchObject([{ type: 'booking.assigned', resourceId: after }]);
    expect((await read(booking.id)).units.map((unit) => unit.resourceId)).toEqual([after]);
  });

  it('refuses to take the employee off and leave the place open, and the panel does not offer it', async () => {
    const booking = await created('08:30', DAY);
    const resourceId = booking.units[0]?.resourceId ?? '';

    const error = (
      await harness.commands.unassignEmployee.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
        resourceId,
      })
    )._unsafeUnwrapErr();

    expect(error.code).toBe(CODES.unassignNotAllowed);
    const stored = await read(booking.id);
    expect(stored.units.map((unit) => unit.resourceId)).toEqual([resourceId]);
    expect(stored.staffChanges).toEqual({ mayReplace: true, mayRemove: false });
  });

  it('refuses an employee who is busy then and writes nothing', async () => {
    const booking = await created('09:00', DAY);
    const before = booking.units[0]?.resourceId ?? '';
    const busy = otherThan(before);
    const elsewhere = await created('09:00', DAY, staff.openServiceId);
    await harness.commands.assignEmployee.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: elsewhere.id,
      resourceId: busy,
    });
    harness.events.length = 0;

    const error = (
      await harness.commands.assignEmployee.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
        resourceId: busy,
        requirementIndex: 0,
        replaces: before,
      })
    )._unsafeUnwrapErr();

    expect(error.code).toBe(CODES.notEligible);
    expect((await read(booking.id)).units.map((unit) => unit.resourceId)).toEqual([before]);
    expect(harness.events).toHaveLength(0);
  });

  it('lets one of a replacement and a claim of the same employee at the same time win; the loser writes nothing', async () => {
    const booking = await created('09:30', DAY);
    const before = booking.units[0]?.resourceId ?? '';
    const wanted = otherThan(before);
    const open = await created('09:30', DAY, staff.openServiceId);
    const sessions = [createHarness(), createHarness()] as const;
    sessions[0].actAs(staff.admin());
    sessions[1].actAs(wanted === suite.world.ids.ben ? ben() : staff.anna());

    const [replace, claim] = await Promise.all([
      sessions[0].commands.assignEmployee.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
        resourceId: wanted,
        requirementIndex: 0,
        replaces: before,
      }),
      sessions[1].commands.claimBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: open.id,
      }),
    ]);

    expect([replace.isOk(), claim.isOk()].filter(Boolean)).toHaveLength(1);
    const replaced = (await read(booking.id)).units.map((unit) => unit.resourceId);
    const claimed = (await read(open.id)).units.map((unit) => unit.resourceId);
    if (replace.isOk()) {
      expect([replaced, claimed]).toEqual([[wanted], [null]]);
    } else {
      expect([CODES.resourceTaken, CODES.notEligible]).toContain(replace.error.code);
      expect([replaced, claimed]).toEqual([[before], [wanted]]);
    }
  });
});

describe('once a booking has begun, who serves it stays', () => {
  it('lets an employee hand it back a minute before the start, not at the start, and the day plan agrees', async () => {
    const booking = await created('10:00', DAY, staff.openServiceId);
    harness.actAs(ben());
    await harness.commands.claimBooking.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: booking.id,
    });
    const mayHandBack = async () =>
      (
        await harness.queries.getEmployeeDayPlan.execute({
          websiteId: String(suite.world.scope.websiteId),
          date: DAY,
        })
      )
        ._unsafeUnwrap()
        .items.find((item) => item.booking.id === booking.id)?.mayHandBack;

    harness.setNow(at('10:00', DAY));
    const refused = (
      await harness.commands.handBackBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
      })
    )._unsafeUnwrapErr();
    expect(refused.code).toBe(CODES.bookingStarted);
    expect(await mayHandBack()).toBe(false);

    harness.setNow(at('09:59', DAY));
    expect(await mayHandBack()).toBe(true);
    const back = (
      await harness.commands.handBackBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
      })
    )._unsafeUnwrap();
    expect(back.assignment).toBe('open');
  });

  it('refuses a manager to take an employee off or replace them, and the panel offers neither', async () => {
    const booking = await created('10:30', DAY, staff.openServiceId);
    await harness.commands.assignEmployee.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: booking.id,
      resourceId: suite.world.ids.ben,
    });
    harness.setNow(at('10:30', DAY));

    const removed = await harness.commands.unassignEmployee.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: booking.id,
      resourceId: suite.world.ids.ben,
    });
    const replaced = await harness.commands.assignEmployee.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: booking.id,
      resourceId: suite.world.ids.anna,
      requirementIndex: 0,
      replaces: suite.world.ids.ben,
    });

    expect(removed._unsafeUnwrapErr().code).toBe(CODES.bookingStarted);
    expect(replaced._unsafeUnwrapErr().code).toBe(CODES.bookingStarted);
    const stored = await read(booking.id);
    expect(stored.units.map((unit) => unit.resourceId)).toEqual([suite.world.ids.ben]);
    expect(stored.staffChanges).toEqual({ mayReplace: false, mayRemove: false });
  });
});
