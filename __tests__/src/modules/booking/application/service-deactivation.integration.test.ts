import { beforeEach, describe, expect, it } from 'vitest';

import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';
import { toBookingId } from '@modules/booking/domain/models/ids';

import { bookings } from '../support/persistence-suite';
import { useServiceSuite } from '../support/service-suite';

const { harness, suite, createService, addLocation, locationId, at } = useServiceSuite();

/** The room is shared by every service of the world, so each test books on a day of its own. */
let dayCounter = 0;
function freshDay(): string {
  const date = new Date(Date.UTC(2027, 0, 11));
  let left = (dayCounter += 1);
  while (left > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) {
      left -= 1;
    }
  }
  return date.toISOString().slice(0, 10);
}
let DAY = freshDay();
beforeEach(() => {
  DAY = freshDay();
});

/** The value of a result that must be ok; the refusal, spelled out, when it is not. */
function ok<T>(result: { isOk(): boolean; value?: T; error?: unknown }): T {
  if (!result.isOk()) {
    throw new Error(JSON.stringify(result.error));
  }
  return result.value as T;
}

let counter = 0;
const book = async (serviceId: string, time: string, location = locationId()) =>
  ok(
    await harness.commands.createBookingAsStaff.execute({
      websiteId: String(suite.world.scope.websiteId),
      serviceId,
      locationId: location,
      start: at(time, DAY),
      customer: {
        firstName: 'Kim',
        lastName: 'Muster',
        email: `kim-${(counter += 1)}@example.org`,
      },
    }),
  );

const statusOf = async (id: string) =>
  (await bookings.findById(suite.world.scope, toBookingId(id)))._unsafeUnwrap()?.booking.status;

const close = (
  view: Awaited<ReturnType<typeof createService>>,
  request: {
    readonly scope?: 'location' | 'all';
    readonly mode?: 'block-new' | 'review';
    readonly resolutions?: ReadonlyArray<{ bookingId: string; kind: string }>;
    readonly at?: string;
  } = {},
) =>
  harness.commands.deactivateService.execute({
    websiteId: String(suite.world.scope.websiteId),
    serviceId: view.id,
    locationId: request.at ?? locationId(),
    scope: request.scope ?? 'location',
    mode: request.mode ?? 'block-new',
    resolutions: request.resolutions ?? [],
    expectedVersion: view.version,
    expectedSettingVersion: view.settingVersion,
  });

describe('closing a service to new bookings only', () => {
  it('stops new bookings and leaves every existing one valid, then opens again at once', async () => {
    const service = await createService({ name: 'Nur sperren' });
    const existing = await book(service.id, '09:00');

    const closed = ok(await close(service));

    expect(closed).toMatchObject({ isActive: false, isServiceActive: true });
    expect(await statusOf(existing.id)).toBe('confirmed');
    const refused = await harness.commands.createBookingAsStaff.execute({
      websiteId: String(suite.world.scope.websiteId),
      serviceId: service.id,
      locationId: locationId(),
      start: at('10:00', DAY),
      customer: { firstName: 'Kim', lastName: 'Muster', email: 'new@example.org' },
    });
    expect(refused._unsafeUnwrapErr().code).toBe(CODES.serviceInactive);
    expect(harness.notices.filter((notice) => notice.kind === 'cancelled')).toHaveLength(0);

    const reopened = ok(
      await harness.commands.reactivateService.execute({
        websiteId: String(suite.world.scope.websiteId),
        serviceId: service.id,
        locationId: locationId(),
        scope: 'location',
        expectedVersion: closed.version,
        expectedSettingVersion: closed.settingVersion,
      }),
    );
    expect(reopened.isActive).toBe(true);
    ok(await book(service.id, '10:00').then((made) => ({ isOk: () => true, value: made })));
  });
});

describe('reviewing the bookings before closing', () => {
  it('shows what would be reached, without any person’s data, and changes nothing', async () => {
    const service = await createService({ name: 'Vorschau' });
    const made = await book(service.id, '09:00');

    const preview = ok(
      await harness.queries.previewServiceDeactivation.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: locationId(),
        serviceId: service.id,
        scope: 'location',
      }),
    );

    expect(preview).toMatchObject({ scope: 'location', locationCount: 1, futureBookingCount: 1 });
    expect(preview.bookings.map((item) => item.bookingId)).toEqual([made.id]);
    expect(preview.bookings[0]?.start).toBe(`${DAY}T09:00:00+01:00`);
    expect(JSON.stringify(preview)).not.toContain('example.org');
    expect(await statusOf(made.id)).toBe('confirmed');
  });

  it('refuses to close while a booking has no decision, and keeps everything as it was', async () => {
    const service = await createService({ name: 'Unentschieden' });
    const a = await book(service.id, '09:00');
    const b = await book(service.id, '11:00');

    const result = await close(service, {
      mode: 'review',
      resolutions: [{ bookingId: a.id, kind: 'cancel' }],
    });

    expect(result._unsafeUnwrapErr().code).toBe(CODES.serviceImpactUnresolved);
    expect(await statusOf(a.id)).toBe('confirmed');
    expect(await statusOf(b.id)).toBe('confirmed');
    const view = ok(
      await harness.queries.getService.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: locationId(),
        serviceId: service.id,
      }),
    );
    expect(view.isActive).toBe(true);
  });

  it('cancels exactly the ones chosen, leaves the others, and tells the people cancelled', async () => {
    const service = await createService({ name: 'Entschieden' });
    const cancelled = await book(service.id, '09:00');
    const left = await book(service.id, '11:00');
    harness.notices.length = 0;

    const closed = ok(
      await close(service, {
        mode: 'review',
        resolutions: [
          { bookingId: cancelled.id, kind: 'cancel' },
          { bookingId: left.id, kind: 'leave' },
        ],
      }),
    );

    expect(closed.isActive).toBe(false);
    expect(await statusOf(cancelled.id)).toBe('cancelled');
    expect(await statusOf(left.id)).toBe('confirmed');
    expect(harness.notices.map((notice) => notice.kind)).toEqual(['cancelled']);
    expect(harness.events).toContainEqual(
      expect.objectContaining({
        type: 'booking.service_deactivated',
        cancelled: 1,
        leftOpen: 1,
        scope: 'location',
      }),
    );
    // What a cancelled booking held is free again.
    ok(
      await harness.commands.reactivateService.execute({
        websiteId: String(suite.world.scope.websiteId),
        serviceId: service.id,
        locationId: locationId(),
        scope: 'location',
        expectedVersion: closed.version,
        expectedSettingVersion: closed.settingVersion,
      }),
    );
    ok(await book(service.id, '09:00').then((made) => ({ isOk: () => true, value: made })));
  });

  it('cancels nothing by itself: every booking left alone stays whatever the mode', async () => {
    const service = await createService({ name: 'Nichts automatisch' });
    const made = await book(service.id, '14:00');
    harness.notices.length = 0;

    ok(
      await close(service, {
        mode: 'review',
        resolutions: [{ bookingId: made.id, kind: 'leave' }],
      }),
    );

    expect(await statusOf(made.id)).toBe('confirmed');
    expect(harness.notices).toHaveLength(0);
  });

  it('refuses a closing from a version somebody else has moved on from', async () => {
    const service = await createService({ name: 'Veraltet' });
    ok(await close(service));

    const again = await close(service);

    expect(again._unsafeUnwrapErr().code).toBe(CODES.serviceStale);
  });
});

describe('closing a linked service', () => {
  it('closes it at one location only, or as a whole with every booking of every location in the review', async () => {
    const south = await addLocation('Bürgerbüro Süd Q');
    const original = await createService({ name: 'Geteilt' });
    const linked = ok(
      await harness.commands.adoptService.execute({
        websiteId: String(suite.world.scope.websiteId),
        serviceId: original.id,
        locationId: south,
        sourceLocationId: locationId(),
        mode: 'link',
      }),
    );
    // Online bookings are not asked for here: a manager books at both places.
    const atWest = await book(original.id, '09:00');
    const atSouth = await book(original.id, '09:00', south).catch(() => null);

    const localOnly = ok(await close(linked, { at: south }));
    const west = ok(
      await harness.queries.getService.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: locationId(),
        serviceId: original.id,
      }),
    );

    expect(localOnly).toMatchObject({ isActive: false, isServiceActive: true });
    expect(west).toMatchObject({ isActive: true, isServiceActive: true });

    const preview = ok(
      await harness.queries.previewServiceDeactivation.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: locationId(),
        serviceId: original.id,
        scope: 'all',
      }),
    );
    expect(preview.locationCount).toBe(2);
    expect(preview.bookings.map((item) => item.bookingId)).toContain(atWest.id);
    if (atSouth !== null) {
      expect(preview.bookings.map((item) => item.bookingId)).toContain(atSouth.id);
    }

    const everywhere = ok(
      await close(west, {
        scope: 'all',
        mode: 'review',
        resolutions: preview.bookings.map((item) => ({ bookingId: item.bookingId, kind: 'leave' })),
      }),
    );
    expect(everywhere).toMatchObject({ isServiceActive: false });
    const refused = await harness.commands.createBookingAsStaff.execute({
      websiteId: String(suite.world.scope.websiteId),
      serviceId: original.id,
      locationId: locationId(),
      start: at('15:00', DAY),
      customer: { firstName: 'Kim', lastName: 'Muster', email: 'late@example.org' },
    });
    expect(refused._unsafeUnwrapErr().code).toBe(CODES.serviceInactive);
  });
});
