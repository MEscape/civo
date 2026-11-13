import { describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth';
import type { Actor } from '@modules/auth';
import { toActorId } from '@modules/auth/domain/models/ids';
import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';

import { actorOf } from '../support/application-harness';
import { useStaffSuite } from '../support/staff-suite';

const staff = useStaffSuite();
const { harness, suite, admin, at, create, created, rowsOf } = staff;

describe('who may do what', () => {
  it('refuses everything when nobody is signed in, and writes nothing', async () => {
    harness.actAs(null);
    const before = await rowsOf();

    const results = [
      await create('08:00', '2027-01-12'),
      await harness.queries.listBookings.execute({
        websiteId: String(suite.world.scope.websiteId),
        from: '2027-01-12',
        to: '2027-01-12',
        page: {},
      }),
      await harness.queries.getBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: 'anything',
      }),
      await harness.commands.cancelBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: 'anything',
      }),
      await harness.commands.claimBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: 'anything',
      }),
    ];

    for (const result of results) {
      expect(result._unsafeUnwrapErr().kind).toBe('forbidden');
    }
    expect(await rowsOf()).toBe(before);
    expect(harness.events).toHaveLength(0);
  });

  it.each([
    ['viewer', '08:30'],
    ['contributor', '09:00'],
    ['employee', '09:30'],
  ] as const)('does not let a %s manage bookings', async (role, time) => {
    const booking = await created(time, '2027-01-12');
    harness.actAs(actorOf(suite.world, role));

    const results = [
      await create('16:30', '2027-01-12'),
      await harness.commands.cancelBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
      }),
      await harness.commands.rescheduleBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
        start: at('09:30', '2027-01-12'),
      }),
      await harness.commands.assignEmployee.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
        resourceId: suite.world.ids.anna,
      }),
    ];

    for (const result of results) {
      expect(result._unsafeUnwrapErr().code).toBe('auth.permission_denied');
    }
    harness.actAs(admin());
    const after = (
      await harness.queries.getBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
      })
    )._unsafeUnwrap();
    expect(after.status).toBe('confirmed');
  });

  it("treats another tenant's booking as missing, whatever the role", async () => {
    const booking = await created('10:00', '2027-01-12');
    const stranger: Actor = {
      id: toActorId('actor-stranger'),
      tenantId: toTenantId(String(suite.world.otherScope.tenantId)),
      roles: ['admin'],
    };
    harness.actAs(stranger);

    const read = await harness.queries.getBooking.execute({
      websiteId: String(suite.world.otherScope.websiteId),
      bookingId: booking.id,
    });
    const cancel = await harness.commands.cancelBooking.execute({
      websiteId: String(suite.world.otherScope.websiteId),
      bookingId: booking.id,
    });

    expect(read._unsafeUnwrapErr().code).toBe(CODES.bookingNotFound);
    expect(cancel._unsafeUnwrapErr().code).toBe(CODES.bookingNotFound);
    harness.actAs(admin());
    expect(
      (
        await harness.queries.getBooking.execute({
          websiteId: String(suite.world.scope.websiteId),
          bookingId: booking.id,
        })
      )._unsafeUnwrap().status,
    ).toBe('confirmed');
  });

  it('shows a viewer when and what was booked, but never who booked', async () => {
    const booking = await created('11:30', '2027-01-12');
    const day = { from: '2027-01-12', to: '2027-01-12', page: {} };

    const managed = (
      await harness.queries.listBookings.execute({
        websiteId: String(suite.world.scope.websiteId),
        ...day,
      })
    )._unsafeUnwrap();
    expect(managed.items.find((item) => item.id === booking.id)?.customer).not.toBeNull();

    harness.actAs(actorOf(suite.world, 'viewer'));
    const viewed = (
      await harness.queries.listBookings.execute({
        websiteId: String(suite.world.scope.websiteId),
        ...day,
      })
    )._unsafeUnwrap();
    const one = (
      await harness.queries.getBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
      })
    )._unsafeUnwrap();
    const calendar = (
      await harness.queries.getBookingCalendar.execute({
        websiteId: String(suite.world.scope.websiteId),
        from: day.from,
        to: day.to,
      })
    )._unsafeUnwrap();

    expect(viewed.items.find((item) => item.id === booking.id)?.customer).toBeNull();
    expect(one.customer).toBeNull();
    expect(calendar.items.every((item) => item.customer === null)).toBe(true);
  });

  it("lists only the signed-in tenant's bookings", async () => {
    await created('10:30', '2027-01-12');
    harness.actAs({ ...admin(), tenantId: toTenantId(String(suite.world.otherScope.tenantId)) });

    const page = (
      await harness.queries.listBookings.execute({
        websiteId: String(suite.world.otherScope.websiteId),
        from: '2027-01-01',
        to: '2027-01-31',
        page: {},
      })
    )._unsafeUnwrap();

    expect(page.total).toBe(0);
  });
});
