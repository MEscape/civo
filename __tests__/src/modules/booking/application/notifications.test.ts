import { describe, expect, it } from 'vitest';

import { CancelBookingAsStaff } from '@modules/booking/application/commands/cancel-booking-as-staff';
import { CancelOwnBooking } from '@modules/booking/application/commands/cancel-own-booking';
import { RescheduleBookingAsStaff } from '@modules/booking/application/commands/reschedule-booking-as-staff';
import { RescheduleOwnBooking } from '@modules/booking/application/commands/reschedule-own-booking';

import { actorWithRole } from '../support/fakes';
import { TENANT, WEBSITE, at } from '../support/fixtures';
import { book, confirm, hold, iso } from '../support/flow-helpers';
import { createWorld } from '../support/world';

/**
 * A visitor who books, moves or cancels is told by e-mail. The message is a
 * consequence of a stored booking: it carries the time the clock at the
 * LOCATION shows, and only goes out when something actually changed.
 */
describe('telling the visitor', () => {
  it('confirms a booking with the time at the location', async () => {
    const world = createWorld();
    const booking = await book(world);

    expect(world.notifier.kinds()).toEqual(['confirmed']);
    expect(world.notifier.notices[0]).toMatchObject({
      to: 'ada@example.org',
      reference: booking.reference,
      localDate: '2027-01-05',
      localTime: '10:00',
      timeZone: 'Europe/Berlin',
      locationName: 'Town hall',
    });
  });

  it('says nothing while the visitor has only reserved a time', async () => {
    const world = createWorld();
    await hold(world);

    expect(world.notifier.notices).toEqual([]);
  });

  it('does not send the confirmation twice when the request is repeated', async () => {
    const world = createWorld();
    const held = (await hold(world))._unsafeUnwrap();
    await confirm(world, held.holdId);
    await confirm(world, held.holdId);

    expect(world.notifier.kinds()).toEqual(['confirmed']);
  });

  it('says nothing about a confirmation that failed', async () => {
    const world = createWorld();
    const held = (await hold(world))._unsafeUnwrap();
    await confirm(world, held.holdId, { firstName: 'Ada' });

    expect(world.notifier.notices).toEqual([]);
  });

  it('tells the visitor when they cancel, and when they move', async () => {
    const world = createWorld();
    const booking = await book(world);
    const access = { websiteId: WEBSITE, reference: booking.reference, email: 'ada@example.org' };
    await new RescheduleOwnBooking(world.flow).execute({
      ...access,
      start: iso(at('2027-01-06', '14:00')),
    });
    await new CancelOwnBooking(world.flow).execute(access);

    expect(world.notifier.kinds()).toEqual(['confirmed', 'rescheduled', 'cancelled']);
    expect(world.notifier.notices[1]).toMatchObject({
      localDate: '2027-01-06',
      localTime: '14:00',
    });
  });

  it('does not tell anyone about a change that was refused', async () => {
    const world = createWorld();
    const booking = await book(world);
    world.clock.set(new Date(at('2027-01-04', '12:00')));
    await new CancelOwnBooking(world.flow).execute({
      websiteId: WEBSITE,
      reference: booking.reference,
      email: 'ada@example.org',
    });

    expect(world.notifier.kinds()).toEqual(['confirmed']);
  });

  it('tells the visitor when staff cancel or move their booking', async () => {
    const world = createWorld({ actor: actorWithRole(TENANT, 'editor') });
    await book(world);
    const id = world.bookings.all()[0]?.id ?? '';
    await new RescheduleBookingAsStaff(world.admin).execute({
      bookingId: id,
      start: iso(at('2027-01-06', '15:00')),
    });
    await new CancelBookingAsStaff(world.admin).execute({ bookingId: id });

    expect(world.notifier.kinds()).toEqual(['confirmed', 'rescheduled', 'cancelled']);
    expect(world.notifier.notices.every((notice) => notice.to === 'ada@example.org')).toBe(true);
  });

  it('sends each notice to the address of its own visitor', async () => {
    const world = createWorld();
    await book(world, undefined, 'ada@example.org');
    await book(world, iso(at('2027-01-06', '10:00')), 'grace@example.org');

    expect(world.notifier.notices.map((notice) => notice.to)).toEqual([
      'ada@example.org',
      'grace@example.org',
    ]);
  });
});
