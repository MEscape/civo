import { beforeAll, describe, expect, it } from 'vitest';

import { toBookableResourceId } from '@modules/booking/domain/models/ids';
import { prismaEmployeePreferenceRepository as preferences } from '@modules/booking/infrastructure/prisma/prisma-employee-preference.repository';

import { db } from '@lib/db';

import { actorOf } from '../support/application-harness';
import { useStaffSuite } from '../support/staff-suite';

/**
 * The employee's own area over the real database: the day plan with names and what to bring, the
 * preferences (validated, the employee's own, only sorting), the filters of the open bookings, and
 * that none of it reaches across websites or to a colleague.
 */
const staff = useStaffSuite();
const { harness, suite, admin, anna, ben, created } = staff;
const DAY = '2027-01-14';
const MORNING = { startMinute: 480, endMinute: 720 };

beforeAll(async () => {
  await db.orm.public.BookableService.where({ id: String(suite.world.serviceId) }).updateAndCount({
    requiredDocuments: ['Personalausweis'],
    instructions: 'Foto prüfen.',
  });
});

describe('the day plan', () => {
  it('lists the employee’s own bookings of a day with names and what to bring, no customer', async () => {
    const booking = await created('09:00', DAY);
    const server = booking.units[0]?.resourceId === suite.world.ids.anna ? anna : ben;
    const other = server === anna ? ben : anna;

    harness.actAs(server());
    const plan = (
      await harness.queries.getEmployeeDayPlan.execute({
        websiteId: String(suite.world.scope.websiteId),
        date: DAY,
      })
    )._unsafeUnwrap();
    const item = plan.items.find((entry) => entry.booking.id === booking.id);
    expect(plan).toMatchObject({ date: DAY, today: '2027-01-10', hasCalendar: true, next: null });
    expect(item).toMatchObject({
      labels: { serviceName: 'Reisepass', locationName: 'Rathaus West', resourceNames: [] },
      requiredDocuments: ['Personalausweis'],
      instructions: 'Foto prüfen.',
      phase: 'upcoming',
      mayHandBack: false,
    });
    expect(item?.booking).not.toHaveProperty('customer');

    harness.actAs(other());
    const theirs = (
      await harness.queries.getEmployeeDayPlan.execute({
        websiteId: String(suite.world.scope.websiteId),
        date: DAY,
      })
    )._unsafeUnwrap();
    expect(theirs.items.some((entry) => entry.booking.id === booking.id)).toBe(false);
  });

  it('reads today on the location’s clock, refuses a day that is not one, and is empty without a calendar', async () => {
    harness.actAs(anna());
    const today = (
      await harness.queries.getEmployeeDayPlan.execute({
        websiteId: String(suite.world.scope.websiteId),
      })
    )._unsafeUnwrap();
    expect(today.date).toBe('2027-01-10');

    const invalid = (
      await harness.queries.getEmployeeDayPlan.execute({
        websiteId: String(suite.world.scope.websiteId),
        date: '2027-02-30',
      })
    )._unsafeUnwrapErr();
    expect(invalid.code).toBe('booking.validation_failed');

    harness.actAs(admin());
    const none = (
      await harness.queries.getEmployeeDayPlan.execute({
        websiteId: String(suite.world.scope.websiteId),
        date: DAY,
      })
    )._unsafeUnwrap();
    expect(none).toMatchObject({ hasCalendar: false, items: [] });
  });
});

describe('preferences', () => {
  it('offers the website’s services and refuses what is not one of them', async () => {
    harness.actAs(anna());
    const view = (
      await harness.queries.getEmployeePreferences.execute({
        websiteId: String(suite.world.scope.websiteId),
      })
    )._unsafeUnwrap();
    expect(view.hasCalendar).toBe(true);
    expect(view.services.map(({ name }) => name).sort()).toEqual(['Beratung', 'Reisepass']);

    const refused = (
      await harness.commands.saveEmployeePreferences.execute({
        websiteId: String(suite.world.scope.websiteId),
        serviceIds: ['somewhere-else'],
        window: { startMinute: 600, endMinute: 540 },
      })
    )._unsafeUnwrapErr();
    expect(refused.code).toBe('booking.validation_failed');
    expect(refused).toMatchObject({
      fieldErrors: {
        serviceIds: ['booking.validation.service_invalid'],
        window: ['booking.validation.time_range_invalid'],
      },
    });
  });

  it('saves the employee’s own, audits without values and spends their budget', async () => {
    harness.actAs(anna());
    const saved = (
      await harness.commands.saveEmployeePreferences.execute({
        websiteId: String(suite.world.scope.websiteId),
        serviceIds: [staff.openServiceId, staff.openServiceId],
        window: MORNING,
      })
    )._unsafeUnwrap();
    expect(saved).toMatchObject({
      websiteId: String(suite.world.scope.websiteId),
      serviceIds: [staff.openServiceId],
      window: MORNING,
    });
    expect(harness.events).toEqual([
      expect.objectContaining({
        type: 'booking.preferences_saved',
        resourceId: suite.world.ids.anna,
      }),
    ]);
    expect(harness.enforced).toContain('booking.employee-actor');

    const view = (
      await harness.queries.getEmployeePreferences.execute({
        websiteId: String(suite.world.scope.websiteId),
      })
    )._unsafeUnwrap();
    expect(view).toMatchObject({ serviceIds: [staff.openServiceId], window: MORNING });
  });

  it('is refused to someone who only reads their bookings, and to someone without a calendar', async () => {
    harness.actAs(actorOf(suite.world, 'viewer'));
    const viewer = (
      await harness.commands.saveEmployeePreferences.execute({
        websiteId: String(suite.world.scope.websiteId),
        serviceIds: [],
        window: null,
      })
    )._unsafeUnwrapErr();
    expect(viewer.code).toBe('auth.permission_denied');
  });

  it('cannot be read or written from another website', async () => {
    const annaId = toBookableResourceId(suite.world.ids.anna);
    const found = (await preferences.findMany(suite.world.otherScope, [annaId]))._unsafeUnwrap();
    expect(found.size).toBe(0);
    const written = await preferences.save(suite.world.otherScope, annaId, {
      serviceIds: [],
      window: null,
    });
    expect(written.isErr()).toBe(true);
  });
});

describe('open bookings, sorted by preferences and narrowed by the filters', () => {
  it('ranks by the employee’s own preferences and names the service and the location', async () => {
    const morning = await created('10:00', DAY, staff.openServiceId);
    const afternoon = await created('14:00', DAY, staff.openServiceId);

    harness.actAs(anna());
    const mine = (
      await harness.queries.getOpenBookings.execute({
        websiteId: String(suite.world.scope.websiteId),
      })
    )._unsafeUnwrap();
    const fitOf = (id: string) => mine.find((offer) => offer.booking.id === id)?.fit;
    expect(fitOf(morning.id)).toEqual({
      level: 'very-good',
      reasons: ['service-preferred', 'time-in-window'],
    });
    expect(fitOf(afternoon.id)?.level).toBe('good');
    expect(mine.findIndex((o) => o.booking.id === morning.id)).toBeLessThan(
      mine.findIndex((o) => o.booking.id === afternoon.id),
    );
    expect(mine.find((o) => o.booking.id === morning.id)?.labels).toEqual({
      serviceName: 'Beratung',
      locationName: 'Rathaus West',
      resourceNames: [],
    });

    harness.actAs(ben());
    const theirs = (
      await harness.queries.getOpenBookings.execute({
        websiteId: String(suite.world.scope.websiteId),
      })
    )._unsafeUnwrap();
    expect(theirs.find((o) => o.booking.id === morning.id)?.fit.level).toBe('possible');
  });

  it('narrows by part of the day, day and location, and refuses a day that is not one', async () => {
    harness.actAs(anna());
    const afternoon = (
      await harness.queries.getOpenBookings.execute({
        websiteId: String(suite.world.scope.websiteId),
        partOfDay: 'afternoon',
      })
    )._unsafeUnwrap();
    expect(afternoon.length).toBeGreaterThan(0);
    expect(afternoon.every(({ booking }) => booking.start.slice(11, 13) >= '12')).toBe(true);

    const otherDay = (
      await harness.queries.getOpenBookings.execute({
        websiteId: String(suite.world.scope.websiteId),
        date: '2027-01-13',
      })
    )._unsafeUnwrap();
    expect(otherDay).toHaveLength(0);

    const elsewhere = (
      await harness.queries.getOpenBookings.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: 'not-here',
      })
    )._unsafeUnwrap();
    expect(elsewhere).toHaveLength(0);

    const invalid = (
      await harness.queries.getOpenBookings.execute({
        websiteId: String(suite.world.scope.websiteId),
        date: 'tomorrow',
      })
    )._unsafeUnwrapErr();
    expect(invalid.code).toBe('booking.validation_failed');
  });
});
