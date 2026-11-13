import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { CatalogDependencies } from '@modules/booking/application/booking-dependencies';
import { CancelOwnBooking } from '@modules/booking/application/commands/cancel-own-booking';
import { ConfirmBooking } from '@modules/booking/application/commands/confirm-booking';
import { HoldSlot } from '@modules/booking/application/commands/hold-slot';
import { RescheduleOwnBooking } from '@modules/booking/application/commands/reschedule-own-booking';
import { GetAvailableSlots } from '@modules/booking/application/queries/get-available-slots';
import { GetBookingCatalog } from '@modules/booking/application/queries/get-booking-catalog';
import { GetOwnBookingSlots } from '@modules/booking/application/queries/get-own-booking-slots';
import { GetPublicBooking } from '@modules/booking/application/queries/get-public-booking';
import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';
import type { BookingNotice } from '@modules/booking/domain/ports/booking-notifier.port';
import { RandomBookingIdentityGenerator } from '@modules/booking/infrastructure/identity/random-booking-identity-generator';
import { prismaBookableResourceRepository } from '@modules/booking/infrastructure/prisma/prisma-bookable-resource.repository';
import { prismaBookableServiceRepository } from '@modules/booking/infrastructure/prisma/prisma-bookable-service.repository';
import { prismaBookingCatalogRepository } from '@modules/booking/infrastructure/prisma/prisma-booking-catalog.repository';
import { prismaBookingLocationRepository } from '@modules/booking/infrastructure/prisma/prisma-booking-location.repository';
import { prismaBookingRepository } from '@modules/booking/infrastructure/prisma/prisma-booking.repository';
import { prismaWebsiteDirectoryRepository } from '@modules/booking/infrastructure/prisma/prisma-website-directory.repository';

import { db } from '@lib/db';
import { okAsync } from '@lib/result';

import { useWorld } from '../support/persistence-suite';

const suite = useWorld();

/** The moment every use case reads; a test moves it to cross a deadline or an expiry. */
let now = new Date('2027-01-10T11:00:00Z');
const notices: BookingNotice[] = [];

const deps: CatalogDependencies = {
  bookings: prismaBookingRepository,
  services: prismaBookableServiceRepository,
  resources: prismaBookableResourceRepository,
  locations: prismaBookingLocationRepository,
  catalog: prismaBookingCatalogRepository,
  websites: prismaWebsiteDirectoryRepository,
  audit: { record: () => undefined },
  clock: { now: () => now },
  rateLimiter: {
    enforce: () => okAsync({ limit: 1, remaining: 1, resetAfterSeconds: 1, degraded: false }),
    enforceAll: () => okAsync([]),
  },
  notifier: {
    notify: (notice) => {
      notices.push(notice);
      return okAsync(undefined);
    },
  },
  identity: new RandomBookingIdentityGenerator(),
  clientAddress: { current: () => Promise.resolve({ kind: 'client', address: '203.0.113.9' }) },
};

const catalog = new GetBookingCatalog(deps);
const slots = new GetAvailableSlots(deps);
const holdSlot = new HoldSlot(deps);
const confirm = new ConfirmBooking(deps);
const lookUp = new GetPublicBooking(deps);
const cancel = new CancelOwnBooking(deps);
const reschedule = new RescheduleOwnBooking(deps);

const websiteId = () => String(suite.world.scope.websiteId);
const target = () => ({
  websiteId: websiteId(),
  serviceId: String(suite.world.serviceId),
  locationId: String(suite.world.locationId),
});
/** A start on the location's clock (Berlin, winter). */
const at = (time: string, day = '2027-01-11') => `${day}T${time}:00+01:00`;

let counter = 0;
async function book(time: string, locale?: string) {
  counter += 1;
  const email = `self-${counter}@example.org`;
  const held = (
    await holdSlot.execute({ ...target(), start: at(time), ...(locale ? { locale } : {}) })
  )._unsafeUnwrap();
  const booked = (
    await confirm.execute({
      websiteId: websiteId(),
      bookingId: held.id,
      customer: { firstName: 'Mira', email },
    })
  )._unsafeUnwrap();
  return { booked, email };
}

beforeAll(async () => {
  // Visitors must give their address; a day's notice for cancelling and moving.
  await db.orm.public.BookableService.where({ id: String(suite.world.serviceId) }).updateAndCount({
    category: 'Ausweise',
    description: 'Neuer Reisepass',
    information: [{ field: 'email', isRequired: true }],
    cancellation: { isAllowed: true, deadlineMinutes: 1440, allowedActors: ['customer'] },
    rescheduling: { isAllowed: false, deadlineMinutes: 0, allowedActors: ['manager'] },
  });
});

beforeEach(() => {
  now = new Date('2027-01-10T11:00:00Z');
  notices.length = 0;
});

describe('the catalog', () => {
  it('offers the service with its place, its rules and the place’s today, and no staff', async () => {
    const view = (await catalog.execute({ websiteId: websiteId() }))._unsafeUnwrap();

    expect(view.services).toEqual([
      expect.objectContaining({
        id: String(suite.world.serviceId),
        name: 'Reisepass',
        category: 'Ausweise',
        durationMinutes: 30,
        horizonDays: 30,
        information: [{ field: 'email', isRequired: true }],
        cancellation: { isAllowed: true, deadlineMinutes: 1440 },
        rescheduling: { isAllowed: false, deadlineMinutes: 0 },
        locationIds: [String(suite.world.locationId)],
      }),
    ]);
    expect(view.locations).toEqual([
      expect.objectContaining({
        name: 'Rathaus West',
        timeZone: 'Europe/Berlin',
        today: '2027-01-10',
      }),
    ]);
    expect(JSON.stringify(view)).not.toContain(suite.world.ids.anna);
  });

  it('narrows to the category or the service the page was set up with', async () => {
    const byCategory = await catalog.execute({ websiteId: websiteId(), category: ' ausweise ' });
    const otherCategory = await catalog.execute({ websiteId: websiteId(), category: 'Kfz' });
    const otherService = await catalog.execute({ websiteId: websiteId(), serviceId: 'nope' });

    expect(byCategory._unsafeUnwrap().services).toHaveLength(1);
    expect(otherCategory._unsafeUnwrap()).toEqual({
      services: [],
      locations: [],
      isTruncated: false,
    });
    expect(otherService._unsafeUnwrap().services).toEqual([]);
  });

  it('leaves out a place where the service takes no online bookings', async () => {
    const row = db.orm.public.BookableServiceLocation.where({
      serviceId: String(suite.world.serviceId),
      locationId: String(suite.world.locationId),
    });
    await row.updateAndCount({ isOnlineBookable: false });
    try {
      expect((await catalog.execute({ websiteId: websiteId() }))._unsafeUnwrap()).toEqual({
        services: [],
        locations: [],
        isTruncated: false,
      });
    } finally {
      await row.updateAndCount({ isOnlineBookable: true });
    }
  });
});

describe('the reservation', () => {
  it('lets one of two visitors have the last free employee at a time', async () => {
    await book('09:00');
    const [first, second] = await Promise.all([
      holdSlot.execute({ ...target(), start: at('09:00') }),
      holdSlot.execute({ ...target(), start: at('09:00') }),
    ]);

    const outcomes = [first, second].map((result) => (result.isOk() ? 'held' : result.error.code));
    expect(outcomes.sort()).toEqual([CODES.slotUnavailable, 'held'].sort());
    const offered = (
      await slots.execute({ ...target(), from: '2027-01-11', to: '2027-01-11' })
    )._unsafeUnwrap();
    expect(offered.slots.map((slot) => slot.start)).not.toContain(at('09:00'));
  });

  it('runs out: a late confirmation is refused and the time is free for the next visitor', async () => {
    const held = (await holdSlot.execute({ ...target(), start: at('10:00') }))._unsafeUnwrap();
    now = new Date(now.getTime() + 11 * 60_000);

    const late = await confirm.execute({
      websiteId: websiteId(),
      bookingId: held.id,
      customer: { email: 'late@example.org' },
    });
    expect(late._unsafeUnwrapErr().code).toBe(CODES.bookingExpired);
    const offered = (
      await slots.execute({ ...target(), from: '2027-01-11', to: '2027-01-11' })
    )._unsafeUnwrap();
    expect(offered.slots.map((slot) => slot.start)).toContain(at('10:00'));
  });

  it('confirms once however often it is asked, and keeps the visitor’s language for the message', async () => {
    const held = (
      await holdSlot.execute({ ...target(), start: at('11:00'), locale: 'en' })
    )._unsafeUnwrap();
    const request = {
      websiteId: websiteId(),
      bookingId: held.id,
      customer: { email: 'twice@example.org' },
    };

    const [one, two] = [await confirm.execute(request), await confirm.execute(request)];
    expect(one._unsafeUnwrap().reference).toBe(two._unsafeUnwrap().reference);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      kind: 'confirmed',
      locale: 'en',
      serviceName: 'Reisepass',
      locationName: 'Rathaus West',
    });
  });
});

describe('my booking', () => {
  it('answers a wrong address exactly like an unknown reference', async () => {
    const { booked } = await book('13:00');

    const wrongAddress = await lookUp.execute({
      websiteId: websiteId(),
      reference: booked.reference,
      email: 'someone-else@example.org',
    });
    const unknown = await lookUp.execute({
      websiteId: websiteId(),
      reference: 'ZZZZZZZZZZ',
      email: 'someone-else@example.org',
    });
    expect(wrongAddress._unsafeUnwrapErr()).toEqual(unknown._unsafeUnwrapErr());
    expect(wrongAddress._unsafeUnwrapErr().code).toBe(CODES.bookingNotFound);
  });

  it('says what may be changed until when, on the location’s clock', async () => {
    const { booked, email } = await book('14:00');

    const view = (
      await lookUp.execute({ websiteId: websiteId(), reference: booked.reference, email })
    )._unsafeUnwrap();
    expect(view).toMatchObject({
      serviceName: 'Reisepass',
      locationName: 'Rathaus West',
      start: at('14:00'),
      cancellation: { isAllowed: true, until: '2027-01-10T14:00:00+01:00' },
      rescheduling: { isAllowed: false, until: null },
    });
  });

  it('cancels until the deadline and not a minute after', async () => {
    const early = await book('15:00');
    const late = await book('15:30');
    now = new Date('2027-01-10T14:00:00Z'); // 15:00 in Berlin: a day before 15:00, not before 15:30

    const inTime = await cancel.execute({
      websiteId: websiteId(),
      reference: early.booked.reference,
      email: early.email,
    });
    now = new Date('2027-01-10T14:31:00Z');
    const tooLate = await cancel.execute({
      websiteId: websiteId(),
      reference: late.booked.reference,
      email: late.email,
    });

    expect(inTime._unsafeUnwrap().status).toBe('cancelled');
    expect(tooLate._unsafeUnwrapErr().code).toBe(CODES.cancellationDeadlinePassed);
    expect(notices.filter((notice) => notice.kind === 'cancelled')).toHaveLength(1);
  });

  it('offers for a move exactly the times the move accepts, even when the service is no longer online', async () => {
    const { booked, email } = await book('15:00');
    const serviceId = String(suite.world.serviceId);
    const offered = { serviceId, locationId: String(suite.world.locationId) };
    await db.orm.public.BookableService.where({ id: serviceId }).updateAndCount({
      rescheduling: { isAllowed: true, deadlineMinutes: 0, allowedActors: ['customer'] },
    });
    await db.orm.public.BookableServiceLocation.where(offered).updateAndCount({
      isOnlineBookable: false,
    });
    try {
      const day = { from: '2027-01-11', to: '2027-01-11' };
      expect((await slots.execute({ ...target(), ...day })).isErr()).toBe(true);

      const own = new GetOwnBookingSlots(deps);
      const times = (
        await own.execute({ websiteId: websiteId(), reference: booked.reference, email, ...day })
      )._unsafeUnwrap();
      const later = times.slots.find((slot) => slot.start > at('15:00'));
      expect(later).toBeDefined();

      const moved = await reschedule.execute({
        websiteId: websiteId(),
        reference: booked.reference,
        email,
        start: later?.start ?? '',
      });
      expect(moved._unsafeUnwrap().start).toBe(later?.start);
    } finally {
      await db.orm.public.BookableServiceLocation.where(offered).updateAndCount({
        isOnlineBookable: true,
      });
      await db.orm.public.BookableService.where({ id: serviceId }).updateAndCount({
        rescheduling: { isAllowed: false, deadlineMinutes: 0, allowedActors: ['manager'] },
      });
    }
  });

  it('refuses a move the service does not let visitors make, and leaves the booking', async () => {
    const { booked, email } = await book('16:00');

    const moved = await reschedule.execute({
      websiteId: websiteId(),
      reference: booked.reference,
      email,
      start: at('16:30'),
    });
    expect(moved._unsafeUnwrapErr().code).toBe(CODES.reschedulingNotAllowed);
    const view = (
      await lookUp.execute({ websiteId: websiteId(), reference: booked.reference, email })
    )._unsafeUnwrap();
    expect(view.start).toBe(at('16:00'));
  });
});
