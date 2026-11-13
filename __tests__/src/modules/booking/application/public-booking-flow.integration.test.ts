import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';

import { db } from '@lib/db';

import { createHarness } from '../support/application-harness';
import { useWorld } from '../support/persistence-suite';

const harness = createHarness();
const suite = useWorld();

beforeAll(async () => {
  // The world's service asks for nothing; this one asks for a name and an address.
  await db.orm.public.BookableService.where({ id: String(suite.world.serviceId) }).updateAndCount({
    information: [
      { field: 'firstName', isRequired: true },
      { field: 'email', isRequired: true },
    ],
  });
});

const CUSTOMER = { firstName: 'Julia', email: 'julia@example.org' } as const;
const at = (time: string, day = '2027-01-11') => `${day}T${time}:00+01:00`;

function target<T extends object>(extra: T) {
  const { scope, serviceId, locationId } = suite.world;
  return {
    websiteId: String(scope.websiteId),
    serviceId: String(serviceId),
    locationId: String(locationId),
    ...extra,
  };
}

async function hold(time: string, day?: string) {
  return harness.commands.holdSlot.execute(target({ start: at(time, day) }));
}

let counter = 0;

/** Books `time` for a visitor with an address of their own (the cap on live bookings is per address). */
async function book(time: string, day?: string, email = `visitor-${(counter += 1)}@example.org`) {
  const held = (await hold(time, day))._unsafeUnwrap();
  const confirmed = await harness.commands.confirmBooking.execute({
    websiteId: held.websiteId,
    bookingId: held.id,
    customer: { firstName: 'Julia', email },
  });
  return { ...confirmed._unsafeUnwrap(), email };
}

const countRows = async () =>
  (await db.orm.public.Booking.where({ websiteId: String(suite.world.scope.websiteId) }).all())
    .length;

beforeEach(() => {
  harness.unlimit();
  harness.actAs(null);
  harness.events.length = 0;
  harness.notices.length = 0;
  harness.enforced.length = 0;
});

describe('availability', () => {
  it('offers the starts of the working day and leaves out the lunch break', async () => {
    const view = (
      await harness.queries.getAvailableSlots.execute(
        target({ from: '2027-01-12', to: '2027-01-12' }),
      )
    )._unsafeUnwrap();

    const starts = view.slots.map((slot) => slot.start.slice(11, 16));
    expect(view.timeZone).toBe('Europe/Berlin');
    expect(starts[0]).toBe('08:00');
    expect(starts).toContain('11:30');
    expect(starts).not.toContain('12:00');
    expect(starts).not.toContain('12:30');
    expect(starts).toContain('13:00');
    expect(starts.at(-1)).toBe('16:30');
  });

  it('answers "website not found" for a website that does not exist, without a tenant to guess', async () => {
    const error = (
      await harness.queries.getAvailableSlots.execute(
        target({ websiteId: 'no-such-site', from: '2027-01-12', to: '2027-01-12' }),
      )
    )._unsafeUnwrapErr();
    expect(error.code).toBe(CODES.websiteNotFound);
  });

  it('answers "website not found" while the website is not published', async () => {
    const id = String(suite.world.scope.websiteId);
    const published = await db.orm.public.Website.where({ id })
      .select('publishedReleaseId')
      .first();
    await db.orm.public.Website.where({ id }).updateAndCount({ publishedReleaseId: null });
    try {
      const error = (
        await harness.queries.getAvailableSlots.execute(
          target({ from: '2027-01-12', to: '2027-01-12' }),
        )
      )._unsafeUnwrapErr();
      expect(error.code).toBe(CODES.websiteNotFound);
    } finally {
      await db.orm.public.Website.where({ id }).updateAndCount({
        publishedReleaseId: published?.publishedReleaseId ?? null,
      });
    }
  });

  it("does not offer another website's service, even with a real website id", async () => {
    const error = (
      await harness.queries.getAvailableSlots.execute(
        target({
          websiteId: String(suite.world.otherScope.websiteId),
          from: '2027-01-12',
          to: '2027-01-12',
        }),
      )
    )._unsafeUnwrapErr();
    expect(error.code).toBe(CODES.serviceNotFound);
  });

  it('refuses a malformed day range as a validation error', async () => {
    const error = (
      await harness.queries.getAvailableSlots.execute(
        target({ from: '2027-01-13', to: '2027-01-12' }),
      )
    )._unsafeUnwrapErr();
    expect(error.kind).toBe('validation');
  });
});

describe('hold, confirm and look up', () => {
  it('turns a hold into a booking and tells the customer only after it is stored', async () => {
    const held = (await hold('08:00'))._unsafeUnwrap();
    expect(held.status).toBe('held');
    expect(held.holdExpiresAt).not.toBeNull();
    expect(harness.notices).toHaveLength(0);

    const confirmed = (
      await harness.commands.confirmBooking.execute({
        websiteId: held.websiteId,
        bookingId: held.id,
        customer: CUSTOMER,
      })
    )._unsafeUnwrap();

    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.holdExpiresAt).toBeNull();
    expect(harness.notices.map((n) => n.kind)).toEqual(['confirmed']);
    expect(harness.notices[0]?.to).toBe('julia@example.org');
    expect(harness.events.map((e) => e.type)).toEqual(['booking.held', 'booking.confirmed']);
    // The audit trail carries ids, never the person.
    expect(JSON.stringify(harness.events)).not.toContain('julia');
  });

  it('is safe to confirm twice: one booking, one message', async () => {
    const held = (await hold('08:30'))._unsafeUnwrap();
    const confirm = () =>
      harness.commands.confirmBooking.execute({
        websiteId: held.websiteId,
        bookingId: held.id,
        customer: CUSTOMER,
      });

    const first = (await confirm())._unsafeUnwrap();
    const second = (await confirm())._unsafeUnwrap();

    expect(second.id).toBe(first.id);
    expect(second.status).toBe('confirmed');
    expect(harness.notices).toHaveLength(1);
  });

  it('does not let a second person confirm a booking that is already confirmed for someone else', async () => {
    const held = (await hold('09:00'))._unsafeUnwrap();
    await harness.commands.confirmBooking.execute({
      websiteId: held.websiteId,
      bookingId: held.id,
      customer: CUSTOMER,
    });

    const error = (
      await harness.commands.confirmBooking.execute({
        websiteId: held.websiteId,
        bookingId: held.id,
        customer: { firstName: 'Mallory', email: 'mallory@example.org' },
      })
    )._unsafeUnwrapErr();

    expect(error.kind).not.toBe('unexpected');
    expect(error.code).toBe(CODES.invalidStateTransition);
  });

  it('refuses a customer who left out what the service asks for, and keeps the hold', async () => {
    const held = (await hold('09:30'))._unsafeUnwrap();

    const error = (
      await harness.commands.confirmBooking.execute({
        websiteId: held.websiteId,
        bookingId: held.id,
        customer: { firstName: 'Julia' },
      })
    )._unsafeUnwrapErr();

    expect(error.code).toBe(CODES.validationFailed);
    expect(error.kind === 'validation' && Object.keys(error.fieldErrors)).toEqual([
      'customer.email',
    ]);
    expect(harness.notices).toHaveLength(0);
  });

  it('finds a booking by reference and e-mail, and by nothing less', async () => {
    const booking = await book('10:00');
    const key = {
      websiteId: booking.websiteId,
      reference: booking.reference,
      email: booking.email,
    };

    const found = (await harness.queries.getPublicBooking.execute(key))._unsafeUnwrap();
    expect(found.id).toBe(booking.id);
    // A visitor never sees who is serving them, nor anybody's data.
    expect(Object.keys(found)).not.toContain('units');
    expect(Object.keys(found)).not.toContain('customer');

    const wrongMail = await harness.queries.getPublicBooking.execute({
      ...key,
      email: 'someone@else.org',
    });
    const wrongReference = await harness.queries.getPublicBooking.execute({
      ...key,
      reference: 'ZZZZZZZZZZ',
    });
    expect(wrongMail._unsafeUnwrapErr().code).toBe(CODES.bookingNotFound);
    // Same answer for "no such reference" and "not your address": nothing to probe.
    expect(wrongReference._unsafeUnwrapErr()).toEqual(wrongMail._unsafeUnwrapErr());
  });

  it("does not find a booking through another website's door", async () => {
    const booking = await book('10:30');
    const error = (
      await harness.queries.getPublicBooking.execute({
        websiteId: String(suite.world.otherScope.websiteId),
        reference: booking.reference,
        email: booking.email,
      })
    )._unsafeUnwrapErr();
    expect(error.code).toBe(CODES.bookingNotFound);
  });

  it('gives a hold back and frees the time for the next visitor', async () => {
    const held = (await hold('11:00'))._unsafeUnwrap();
    await harness.commands.releaseHold.execute({ websiteId: held.websiteId, bookingId: held.id });

    const next = (await hold('11:00'))._unsafeUnwrap();
    expect(next.id).not.toBe(held.id);
    expect(harness.events.map((e) => e.type)).toContain('booking.hold_released');
  });
});

describe('two visitors, one time', () => {
  it('lets exactly as many holds through as there are qualified employees', async () => {
    // Two employees can serve the service: the third visitor for 13:00 loses.
    const results = await Promise.all([hold('13:00'), hold('13:00'), hold('13:00')]);

    const won = results.filter((r) => r.isOk());
    const lost = results.flatMap((r) => (r.isErr() ? [r.error] : []));
    expect(won).toHaveLength(2);
    expect(lost).toHaveLength(1);
    expect(lost[0]?.kind).toBe('conflict');
    expect([CODES.slotUnavailable, CODES.resourceTaken]).toContain(lost[0]?.code);
    // The loser left no row behind, and the conflict was recorded without any personal data.
    expect(
      harness.events.filter((e) => e.type === 'booking.conflict_detected').length,
    ).toBeLessThanOrEqual(1);
  });

  it('stops offering a time once it is taken', async () => {
    await book('14:00');
    await book('14:00');

    const view = (
      await harness.queries.getAvailableSlots.execute(
        target({ from: '2027-01-11', to: '2027-01-11' }),
      )
    )._unsafeUnwrap();
    expect(view.slots.map((slot) => slot.start.slice(11, 16))).not.toContain('14:00');
  });
});

describe('changing your own booking', () => {
  it('cancels with the right e-mail only', async () => {
    const booking = await book('15:00');
    const key = {
      websiteId: booking.websiteId,
      reference: booking.reference,
      email: booking.email,
    };

    const denied = await harness.commands.cancelOwnBooking.execute({
      ...key,
      email: 'mallory@example.org',
    });
    expect(denied._unsafeUnwrapErr().code).toBe(CODES.bookingNotFound);

    const cancelled = (await harness.commands.cancelOwnBooking.execute(key))._unsafeUnwrap();
    expect(cancelled.status).toBe('cancelled');
    expect(harness.notices.map((n) => n.kind)).toEqual(['confirmed', 'cancelled']);
  });

  it('moves a booking to a free time and keeps it to one booking', async () => {
    const booking = await book('15:30');
    const before = await countRows();

    const moved = (
      await harness.commands.rescheduleOwnBooking.execute({
        websiteId: booking.websiteId,
        reference: booking.reference,
        email: booking.email,
        start: at('16:00'),
      })
    )._unsafeUnwrap();

    expect(moved.start).toContain('T16:00');
    expect(moved.rescheduleCount).toBe(1);
    expect(await countRows()).toBe(before);
    expect(harness.notices.at(-1)?.kind).toBe('rescheduled');
  });

  it('leaves a booking where it is when the new time is taken', async () => {
    await book('08:00', '2027-01-12');
    await book('08:00', '2027-01-12');
    const booking = await book('09:00', '2027-01-12');
    harness.notices.length = 0;

    const error = (
      await harness.commands.rescheduleOwnBooking.execute({
        websiteId: booking.websiteId,
        reference: booking.reference,
        email: booking.email,
        start: at('08:00', '2027-01-12'),
      })
    )._unsafeUnwrapErr();

    expect(error.kind).toBe('conflict');
    expect(harness.notices).toHaveLength(0);
    const still = (
      await harness.queries.getPublicBooking.execute({
        websiteId: booking.websiteId,
        reference: booking.reference,
        email: booking.email,
      })
    )._unsafeUnwrap();
    expect(still.start).toBe(booking.start);
  });
});

describe('abuse bounds', () => {
  it('refuses with a rate-limit answer before touching anything once the budget is spent', async () => {
    harness.limitTo(0);
    const before = await countRows();

    const error = (await hold('16:00'))._unsafeUnwrapErr();

    expect(error.kind).toBe('rate_limited');
    expect(await countRows()).toBe(before);
    expect(harness.enforced).toEqual(['booking.hold-client']);
  });

  it('spends the budget of the lookup policy when a booking is looked up', async () => {
    const booking = await book('16:30');
    harness.enforced.length = 0;

    await harness.queries.getPublicBooking.execute({
      websiteId: booking.websiteId,
      reference: booking.reference,
      email: booking.email,
    });

    expect(harness.enforced).toEqual(['booking.lookup-client']);
  });
});
