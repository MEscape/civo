import { beforeAll, beforeEach } from 'vitest';

import { db } from '@lib/db';

import { actorOf, createHarness, employeeActor } from './application-harness';
import { useWorld } from './persistence-suite';

/**
 * What the tests of the manager's and the employees' use cases share: a website of its own with two
 * employees and two services (one assigned at booking time, one whose bookings employees take), a
 * harness whose signed-in person starts as the website's administrator, and the helpers to book.
 */
export function useStaffSuite() {
  const harness = createHarness();
  const suite = useWorld();

  let openServiceId = '';

  beforeAll(async () => {
    const { scope, locationId } = suite.world;
    const site = String(scope.websiteId);
    openServiceId = `${site}-open`;
    const policy = {
      isAllowed: true,
      deadlineMinutes: 60,
      allowedActors: ['customer', 'employee', 'manager'],
    };
    // A service whose bookings employees take for themselves.
    await db.orm.public.BookableService.create({
      id: openServiceId,
      tenantId: site,
      websiteId: site,
      name: 'Beratung',
      durationMinutes: 30,
      slotIntervalMinutes: 30,
      homeLocationId: String(locationId),
      requirements: [
        { resourceType: 'employee', skills: ['ausweise'], count: 1, resourceIds: null },
      ],
      horizonDays: 30,
      cancellation: policy,
      rescheduling: policy,
      information: [],
      requiredDocuments: [],
      assignmentMode: 'open',
    });
    await db.orm.public.BookableServiceLocation.create({
      serviceId: openServiceId,
      locationId: String(locationId),
      tenantId: site,
      websiteId: site,
      resources: [],
    });
  });

  const admin = () => actorOf(suite.world, 'admin');
  const anna = () => employeeActor(suite.world, 'anna');
  const ben = () => employeeActor(suite.world, 'ben');
  const at = (time: string, day: string) => `${day}T${time}:00+01:00`;

  let counter = 0;
  const newCustomer = () => ({ firstName: 'Kim', email: `kim-${(counter += 1)}@example.org` });

  function create(
    time: string,
    day: string,
    extra: { serviceId?: string; requestKey?: string } = {},
  ) {
    return harness.commands.createBookingAsStaff.execute({
      websiteId: String(suite.world.scope.websiteId),
      serviceId: extra.serviceId ?? String(suite.world.serviceId),
      locationId: String(suite.world.locationId),
      start: at(time, day),
      customer: newCustomer(),
      requestKey: extra.requestKey,
    });
  }

  const created = async (time: string, day: string, serviceId?: string) =>
    (await create(time, day, serviceId === undefined ? {} : { serviceId }))._unsafeUnwrap();

  const rowsOf = async () =>
    (await db.orm.public.Booking.where({ websiteId: String(suite.world.scope.websiteId) }).all())
      .length;

  beforeEach(() => {
    harness.unlimit();
    harness.setNow();
    harness.actAs(admin());
    harness.events.length = 0;
    harness.notices.length = 0;
    harness.enforced.length = 0;
  });

  return {
    harness,
    suite,
    admin,
    anna,
    ben,
    at,
    create,
    created,
    rowsOf,
    get openServiceId() {
      return openServiceId;
    },
  };
}
