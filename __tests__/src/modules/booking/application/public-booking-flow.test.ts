import { describe, expect, it } from 'vitest';

import { CancelOwnBooking } from '@modules/booking/application/commands/cancel-own-booking';
import { ConfirmBooking } from '@modules/booking/application/commands/confirm-booking';
import { HoldSlot } from '@modules/booking/application/commands/hold-slot';
import { ReleaseHold } from '@modules/booking/application/commands/release-hold';
import { RescheduleOwnBooking } from '@modules/booking/application/commands/reschedule-own-booking';
import type { BookingView } from '@modules/booking/application/contracts/booking-views';
import { GetAvailableSlots } from '@modules/booking/application/queries/get-available-slots';
import { GetBookingCatalog } from '@modules/booking/application/queries/get-booking-catalog';
import { GetPublicBooking } from '@modules/booking/application/queries/get-public-booking';
import { SuggestAlternativeSlots } from '@modules/booking/application/queries/suggest-alternative-slots';
import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';

import {
  makeBooking,
  makeResource,
  makeService,
  at,
  NOW,
  LOCATION_ID,
  SERVICE_ID,
  WEBSITE,
} from '../support/fixtures';
import { TUESDAY_10, book, confirm, customer, hold, iso } from '../support/flow-helpers';
import { OTHER_WEBSITE, createWorld } from '../support/world';

import type { World } from '../support/world';

function slotTimes(world: World, day: string) {
  return new GetAvailableSlots(world.flow)
    .execute({
      websiteId: WEBSITE,
      serviceId: SERVICE_ID,
      locationId: LOCATION_ID,
      from: day,
      to: day,
      participants: 1,
    })
    .map((view) => view.slots.map((slot) => slot.start.getTime()));
}

describe('catalog', () => {
  it('offers the services of the website with their locations, and nothing of another tenant', async () => {
    const world = createWorld();
    const catalog = (
      await new GetBookingCatalog(world.flow).execute({ websiteId: WEBSITE })
    )._unsafeUnwrap();

    expect(catalog.services.map((service) => service.name)).toEqual(['Passport application']);
    expect(catalog.services[0]?.locations.map((location) => location.name)).toEqual(['Town hall']);
  });

  it('does not show a service that is switched off', async () => {
    const world = createWorld({ service: makeService({ isActive: false }) });
    const catalog = (
      await new GetBookingCatalog(world.flow).execute({ websiteId: WEBSITE })
    )._unsafeUnwrap();

    expect(catalog.services).toEqual([]);
  });

  it('narrows to the services the component is configured with', async () => {
    const world = createWorld();
    const none = (
      await new GetBookingCatalog(world.flow).execute({
        websiteId: WEBSITE,
        serviceIds: ['something-else'],
      })
    )._unsafeUnwrap();

    expect(none.services).toEqual([]);
  });

  it('answers "not found" for a website that does not exist', async () => {
    const world = createWorld();
    const result = await new GetBookingCatalog(world.flow).execute({ websiteId: 'nope' });

    expect(result._unsafeUnwrapErr().code).toBe(CODES.websiteNotFound);
  });

  it('shows another tenant nothing of this one, and hides a service with no location it can see', async () => {
    const world = createWorld();
    const catalog = (
      await new GetBookingCatalog(world.flow).execute({ websiteId: OTHER_WEBSITE })
    )._unsafeUnwrap();

    // Its only service points at a location of the first tenant, which it cannot see:
    // a service nobody can book is not offered.
    expect(catalog.services).toEqual([]);
  });
});

describe('availability', () => {
  it('lists every start time of an opening day on the slot grid', async () => {
    const world = createWorld();
    const starts = (await slotTimes(world, '2027-01-05'))._unsafeUnwrap();

    expect(starts).toHaveLength(20);
    expect(starts[0]).toBe(at('2027-01-05', '08:00'));
    expect(starts.at(-1)).toBe(at('2027-01-05', '17:30'));
  });

  it('offers nothing on a day the location is closed', async () => {
    const world = createWorld();

    expect((await slotTimes(world, '2027-01-09'))._unsafeUnwrap()).toEqual([]);
  });

  it('refuses a range longer than the limit', async () => {
    const world = createWorld();
    const result = await new GetAvailableSlots(world.flow).execute({
      websiteId: WEBSITE,
      serviceId: SERVICE_ID,
      locationId: LOCATION_ID,
      from: '2027-01-05',
      to: '2027-06-05',
      participants: 1,
    });

    expect(result._unsafeUnwrapErr().kind).toBe('validation');
  });

  it('suggests other times when the chosen one is gone', async () => {
    const world = createWorld();
    await hold(world);
    const alternatives = (
      await new SuggestAlternativeSlots(world.flow).execute({
        websiteId: WEBSITE,
        serviceId: SERVICE_ID,
        locationId: LOCATION_ID,
        start: TUESDAY_10,
        participants: 1,
      })
    )._unsafeUnwrap();

    expect(alternatives.slots.length).toBeGreaterThan(0);
    expect(alternatives.slots.map((slot) => slot.start.getTime())).not.toContain(
      at('2027-01-05', '10:00'),
    );
  });
});

describe('holding a slot', () => {
  it('reserves the slot for ten minutes and hides it from others', async () => {
    const world = createWorld();
    const held = (await hold(world))._unsafeUnwrap();

    expect(held.start.getTime()).toBe(at('2027-01-05', '10:00'));
    expect(held.expiresAt.getTime()).toBe(NOW.getTime() + 10 * 60_000);
    expect(world.audit.types()).toContain('booking.held');
    expect((await slotTimes(world, '2027-01-05'))._unsafeUnwrap()).not.toContain(
      at('2027-01-05', '10:00'),
    );
  });

  it('refuses a second visitor the same slot while the first holds it', async () => {
    const world = createWorld();
    await hold(world);
    const second = await hold(world);

    expect(second.isErr()).toBe(true);
    expect([CODES.resourceUnavailable, CODES.bookingConflict]).toContain(
      second._unsafeUnwrapErr().code,
    );
  });

  it('assigns a different resource when one is taken', async () => {
    const world = createWorld({ resources: [makeResource('emp-1'), makeResource('emp-2')] });

    expect((await hold(world)).isOk()).toBe(true);
    expect((await hold(world)).isOk()).toBe(true);
    expect((await hold(world)).isErr()).toBe(true);
  });

  it('frees the slot again when the hold is released', async () => {
    const world = createWorld();
    const held = (await hold(world))._unsafeUnwrap();
    const released = await new ReleaseHold(world.flow).execute({
      websiteId: WEBSITE,
      holdId: held.holdId,
    });

    expect(released.isOk()).toBe(true);
    expect((await hold(world)).isOk()).toBe(true);
  });

  it('frees the slot by itself when the hold runs out', async () => {
    const world = createWorld();
    await hold(world);
    world.clock.advanceMinutes(11);

    expect((await hold(world, TUESDAY_10))._unsafeUnwrap().holdId).toBeDefined();
  });

  it.each([
    ['a time off the slot grid', iso(at('2027-01-05', '10:10')), 1, CODES.slotUnavailable],
    [
      'a time when the location is closed',
      iso(at('2027-01-09', '10:00')),
      1,
      CODES.slotUnavailable,
    ],
    ['a time in the past', iso(at('2027-01-04', '06:00')), 1, undefined],
    ['more participants than allowed', TUESDAY_10, 5, undefined],
    ['a start without an offset', '2027-01-05T10:00:00', 1, undefined],
  ])('refuses %s', async (_label, start, participants, code) => {
    const world = createWorld();
    const result = await hold(world, start, participants);

    expect(result.isErr()).toBe(true);
    if (code !== undefined) {
      expect(result._unsafeUnwrapErr().code).toBe(code);
    }
    expect(world.bookings.all()).toHaveLength(0);
  });

  it('refuses a service or location of another tenant', async () => {
    const world = createWorld();
    const result = await new HoldSlot(world.flow).execute({
      websiteId: OTHER_WEBSITE,
      serviceId: SERVICE_ID,
      locationId: LOCATION_ID,
      start: TUESDAY_10,
      participants: 1,
    });

    expect(result._unsafeUnwrapErr().kind).toBe('not_found');
  });

  it('stops anonymous visitors from reserving without limit', async () => {
    const world = createWorld();
    for (let i = 0; i < 200; i += 1) {
      world.bookings.seed(
        makeBooking({
          id: `abandoned-${i}`,
          start: at('2027-02-01', '08:00') + i * 60_000,
          resources: [`other-${i}`],
          status: 'held',
        }),
      );
    }

    expect((await hold(world))._unsafeUnwrapErr().code).toBe(CODES.tooManyActiveHolds);
  });
});

describe('confirming a booking', () => {
  it('turns the hold into a confirmed booking with a reference', async () => {
    const world = createWorld();
    const booking = await book(world);

    expect(booking.status).toBe('confirmed');
    expect(booking.reference).toMatch(/^R\d{9}$/);
    expect(booking.email).toBe('ada@example.org');
    expect(booking.locationName).toBe('Town hall');
    expect(world.audit.types()).toEqual(['booking.held', 'booking.confirmed']);
  });

  it('reports every missing or malformed field at once', async () => {
    const world = createWorld();
    const held = (await hold(world))._unsafeUnwrap();
    const result = await confirm(world, held.holdId, { email: 'not-an-address' });

    const error = result._unsafeUnwrapErr();
    expect(error.kind).toBe('validation');
    expect(error.kind === 'validation' && Object.keys(error.fieldErrors)).toContain('email');
    expect(world.bookings.get(held.holdId)?.status).toBe('held');
  });

  it('does not keep details the service never asked for', async () => {
    const world = createWorld();
    const held = (await hold(world))._unsafeUnwrap();
    await confirm(world, held.holdId, { ...customer(), phone: '+49 30 123', notes: 'hello' });

    const stored = world.bookings.get(held.holdId)?.customer;
    expect(stored?.phone).toBeNull();
    expect(stored?.notes).toBeNull();
  });

  it('answers a repeated confirmation with the same booking', async () => {
    const world = createWorld();
    const held = (await hold(world))._unsafeUnwrap();
    const first = (await confirm(world, held.holdId))._unsafeUnwrap();
    const again = (await confirm(world, held.holdId))._unsafeUnwrap();

    expect(again.reference).toBe(first.reference);
    expect(world.audit.types().filter((type) => type === 'booking.confirmed')).toHaveLength(1);
  });

  it('does not hand a confirmed booking to someone with another address', async () => {
    const world = createWorld();
    const held = (await hold(world))._unsafeUnwrap();
    await confirm(world, held.holdId);
    const stranger = await confirm(world, held.holdId, customer('mallory@example.org'));

    expect(stranger._unsafeUnwrapErr().kind).toBe('not_found');
  });

  it('refuses a hold that has run out', async () => {
    const world = createWorld();
    const held = (await hold(world))._unsafeUnwrap();
    world.clock.advanceMinutes(11);

    expect((await confirm(world, held.holdId))._unsafeUnwrapErr().code).toBe(CODES.bookingExpired);
  });

  it('refuses a hold of another website', async () => {
    const world = createWorld();
    const held = (await hold(world))._unsafeUnwrap();
    const result = await new ConfirmBooking(world.flow).execute({
      websiteId: OTHER_WEBSITE,
      holdId: held.holdId,
      customer: customer(),
    });

    expect(result._unsafeUnwrapErr().kind).toBe('not_found');
  });

  it('limits how many open bookings one address can have', async () => {
    const world = createWorld();
    for (const day of ['05', '06', '07', '08', '11']) {
      await book(world, iso(at(`2027-01-${day}`, '10:00')));
    }

    const held = (await hold(world, iso(at('2027-01-12', '10:00'))))._unsafeUnwrap();
    expect((await confirm(world, held.holdId))._unsafeUnwrapErr().code).toBe(
      CODES.tooManyActiveBookings,
    );
    // Another address is not affected by it.
    expect((await confirm(world, held.holdId, customer('grace@example.org'))).isOk()).toBe(true);
  });
});

describe('looking up and changing your own booking', () => {
  const access = (booking: BookingView, email = 'ada@example.org') => ({
    websiteId: WEBSITE,
    reference: booking.reference,
    email,
  });

  it('shows the booking to the person who made it, in any letter case', async () => {
    const world = createWorld();
    const booking = await book(world);
    const found = (
      await new GetPublicBooking(world.flow).execute(access(booking, ' ADA@Example.org '))
    )._unsafeUnwrap();

    expect(found.reference).toBe(booking.reference);
    expect(found.canCancel).toBe(true);
  });

  it('answers a wrong address exactly like an unknown reference', async () => {
    const world = createWorld();
    const booking = await book(world);
    const wrongEmail = await new GetPublicBooking(world.flow).execute(
      access(booking, 'mallory@example.org'),
    );
    const unknownReference = await new GetPublicBooking(world.flow).execute({
      websiteId: WEBSITE,
      reference: 'ZZZZZZZZZZ',
      email: 'ada@example.org',
    });

    expect(wrongEmail._unsafeUnwrapErr()).toEqual(unknownReference._unsafeUnwrapErr());
  });

  it('cancels, frees the slot and records who cancelled', async () => {
    const world = createWorld();
    const booking = await book(world);
    const cancelled = (
      await new CancelOwnBooking(world.flow).execute(access(booking))
    )._unsafeUnwrap();

    expect(cancelled.status).toBe('cancelled');
    expect(world.audit.types()).toContain('booking.cancelled');
    expect((await hold(world)).isOk()).toBe(true);
  });

  it('refuses a cancellation after the deadline', async () => {
    const world = createWorld();
    const booking = await book(world);
    world.clock.set(new Date(at('2027-01-04', '12:00')));
    const result = await new CancelOwnBooking(world.flow).execute(access(booking));

    expect(result._unsafeUnwrapErr().code).toBe(CODES.cancellationDeadlinePassed);
  });

  it('refuses a cancellation by someone else', async () => {
    const world = createWorld();
    const booking = await book(world);
    const result = await new CancelOwnBooking(world.flow).execute(
      access(booking, 'mallory@example.org'),
    );

    expect(result._unsafeUnwrapErr().kind).toBe('not_found');
    expect(world.bookings.all()[0]?.status).toBe('confirmed');
  });

  it('moves a booking to another time and keeps its reference', async () => {
    const world = createWorld();
    const booking = await book(world);
    const newStart = iso(at('2027-01-06', '14:00'));
    const moved = (
      await new RescheduleOwnBooking(world.flow).execute({ ...access(booking), start: newStart })
    )._unsafeUnwrap();

    expect(moved.reference).toBe(booking.reference);
    expect(moved.start.getTime()).toBe(at('2027-01-06', '14:00'));
    expect(moved.rescheduleCount).toBe(1);
    // The old time is free again.
    expect((await hold(world)).isOk()).toBe(true);
  });

  it('refuses a move onto a time that is taken, and leaves the booking where it was', async () => {
    const world = createWorld();
    const mine = await book(world);
    await book(world, iso(at('2027-01-06', '14:00')), 'grace@example.org');
    const result = await new RescheduleOwnBooking(world.flow).execute({
      ...access(mine),
      start: iso(at('2027-01-06', '14:00')),
    });

    expect(result.isErr()).toBe(true);
    expect(
      world.bookings
        .all()
        .find((b) => b.reference === mine.reference)
        ?.start.getTime(),
    ).toBe(at('2027-01-05', '10:00'));
  });

  it('lets a customer move a booking only a few times', async () => {
    const world = createWorld();
    const booking = await book(world);
    const times = ['11:00', '12:00', '13:00'];
    for (const time of times) {
      const moved = await new RescheduleOwnBooking(world.flow).execute({
        ...access(booking),
        start: iso(at('2027-01-06', time)),
      });
      expect(moved.isOk()).toBe(true);
    }
    const fourth = await new RescheduleOwnBooking(world.flow).execute({
      ...access(booking),
      start: iso(at('2027-01-06', '15:00')),
    });

    expect(fourth._unsafeUnwrapErr().code).toBe(CODES.reschedulingNotAllowed);
  });
});
