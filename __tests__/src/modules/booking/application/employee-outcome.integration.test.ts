import { describe, expect, it } from 'vitest';

import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';

import { useStaffSuite } from '../support/staff-suite';

/**
 * What an employee records about an appointment of theirs, over the real database: that it took
 * place or that nobody came, only after it began and only for a booking they hold; a colleague's
 * booking is "not found"; and the day plan offers the buttons exactly when the commands would accept.
 */
const staff = useStaffSuite();
const { harness, suite, at, anna, ben, created } = staff;
const DAY = '2027-01-15';

const claimedByBen = async (time: string) => {
  const booking = await created(time, DAY, staff.openServiceId);
  harness.actAs(ben());
  await harness.commands.claimBooking.execute({
    websiteId: String(suite.world.scope.websiteId),
    bookingId: booking.id,
  });
  return booking;
};

const itemOf = async (bookingId: string) =>
  (
    await harness.queries.getEmployeeDayPlan.execute({
      websiteId: String(suite.world.scope.websiteId),
      date: DAY,
    })
  )
    ._unsafeUnwrap()
    .items.find((item) => item.booking.id === bookingId);

describe('an employee recording the outcome of an appointment', () => {
  it('refuses before the appointment began, and the plan does not offer it', async () => {
    const booking = await claimedByBen('11:00');
    harness.setNow(at('10:59', DAY));

    const refused = (
      await harness.commands.completeOwnBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
      })
    )._unsafeUnwrapErr();

    expect(refused.code).toBe(CODES.bookingNotStarted);
    expect((await itemOf(booking.id))?.mayRecordOutcome).toBe(false);
  });

  it('records that it took place once it began, and the plan shows it done', async () => {
    const booking = await claimedByBen('11:30');
    harness.setNow(at('11:30', DAY));
    expect((await itemOf(booking.id))?.mayRecordOutcome).toBe(true);

    await harness.commands.completeOwnBooking.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: booking.id,
    });

    const item = await itemOf(booking.id);
    expect(item?.phase).toBe('done');
    expect(item?.mayRecordOutcome).toBe(false);
  });

  it('records that nobody came', async () => {
    const booking = await claimedByBen('13:00');
    harness.setNow(at('13:10', DAY));

    await harness.commands.markOwnBookingNoShow.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: booking.id,
    });

    expect((await itemOf(booking.id))?.phase).toBe('missed');
  });

  it('does not reach the booking of a colleague', async () => {
    const booking = await claimedByBen('13:30');
    harness.setNow(at('13:40', DAY));
    harness.actAs(anna());

    const error = (
      await harness.commands.completeOwnBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: booking.id,
      })
    )._unsafeUnwrapErr();

    expect(error.code).toBe(CODES.bookingNotFound);
  });
});
