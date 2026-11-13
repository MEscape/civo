import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { BookingFlowDependencies } from '@modules/booking/application/booking-dependencies';
import { GetAvailableSlots } from '@modules/booking/application/queries/get-available-slots';
import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';
import { toBookingLocationId } from '@modules/booking/domain/models/ids';
import { RandomBookingIdentityGenerator } from '@modules/booking/infrastructure/identity/random-booking-identity-generator';
import { prismaBookableResourceRepository } from '@modules/booking/infrastructure/prisma/prisma-bookable-resource.repository';
import { prismaBookableServiceRepository } from '@modules/booking/infrastructure/prisma/prisma-bookable-service.repository';
import { prismaBookingLocationRepository } from '@modules/booking/infrastructure/prisma/prisma-booking-location.repository';
import { prismaBookingRepository } from '@modules/booking/infrastructure/prisma/prisma-booking.repository';
import { prismaWebsiteDirectoryRepository } from '@modules/booking/infrastructure/prisma/prisma-website-directory.repository';

import { db } from '@lib/db';
import { okAsync } from '@lib/result';

import { STORED_WORKING_WEEK } from '../support/booking-fixtures';
import { useWorld } from '../support/persistence-suite';

// Small bounds, so a few rows show what thousands would: three bookings and three resources per read.
vi.mock('@modules/booking/application/booking-limits', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  MAX_BLOCKING_BOOKINGS_PER_QUERY: 3,
  MAX_RESOURCES_PER_WEBSITE: 3,
}));

const suite = useWorld();

const deps: BookingFlowDependencies = {
  bookings: prismaBookingRepository,
  services: prismaBookableServiceRepository,
  resources: prismaBookableResourceRepository,
  locations: prismaBookingLocationRepository,
  websites: prismaWebsiteDirectoryRepository,
  audit: { record: () => undefined },
  clock: { now: () => new Date('2027-01-10T11:00:00Z') },
  rateLimiter: {
    enforce: () => okAsync({ limit: 1, remaining: 1, resetAfterSeconds: 1, degraded: false }),
    enforceAll: () => okAsync([]),
  },
  notifier: { notify: () => okAsync(undefined) },
  identity: new RandomBookingIdentityGenerator(),
  clientAddress: { current: () => Promise.resolve({ kind: 'client', address: '203.0.113.9' }) },
};

const slots = new GetAvailableSlots(deps);
const DAY = '2027-01-12';

const freeStarts = async () => {
  const result = await slots.execute({
    websiteId: String(suite.world.scope.websiteId),
    serviceId: String(suite.world.serviceId),
    locationId: String(suite.world.locationId),
    from: DAY,
    to: DAY,
  });
  return result.map((view) => view.slots.map((slot) => slot.start.slice(11, 16)));
};

async function addEmployee(id: string, locationId: string | null) {
  const { scope } = suite.world;
  await db.orm.public.BookableResource.create({
    id,
    tenantId: String(scope.tenantId),
    websiteId: String(scope.websiteId),
    locationId,
    name: id,
    type: 'employee',
    skills: ['ausweise'],
  });
}

describe('what one location’s free times are read from', () => {
  const ids = {
    east: '',
    carl: '',
    dora: '',
  };

  beforeAll(async () => {
    const { world } = suite;
    ids.east = `${world.ids.room}-east`;
    ids.carl = `${world.ids.room}-carl`;
    ids.dora = `${world.ids.room}-dora`;
    await db.orm.public.BookingLocation.create({
      id: ids.east,
      tenantId: String(world.scope.tenantId),
      websiteId: String(world.scope.websiteId),
      name: 'Rathaus Ost',
      timeZone: 'Europe/Berlin',
      openingHours: STORED_WORKING_WEEK,
    });
    await addEmployee(ids.carl, ids.east);
    // Dora has no location of her own: she serves every location, so her bookings anywhere count.
    await addEmployee(ids.dora, null);

    const east = { locationId: toBookingLocationId(ids.east) };
    await suite.store({ id: 'anna', date: DAY, time: '08:00', units: [world.ids.anna] });
    await suite.store({ id: 'ben', date: DAY, time: '08:00', units: [world.ids.ben] });
    await suite.store({
      id: 'dora',
      date: DAY,
      time: '08:00',
      units: [ids.dora],
      overrides: east,
    });
    // The other location is busy: more bookings than one read may hold, none of them ours.
    for (const time of ['09:00', '10:00', '11:00', '13:00', '14:00']) {
      await suite.store({
        id: `carl-${time}`,
        date: DAY,
        time,
        units: [ids.carl],
        overrides: east,
      });
    }
  });

  it('answers from its own resources while another location has more bookings than the bound', async () => {
    const starts = (await freeStarts())._unsafeUnwrap();

    // Anna, Ben and Dora (at the other location) are all taken at 08:00, and free from 08:30.
    expect(starts).not.toContain('08:00');
    expect(starts).toContain('08:30');
    expect(starts).toContain('09:00');
  });

  it('refuses instead of silently dropping resources when the location has more than the bound', async () => {
    await addEmployee(`${suite.world.ids.room}-eve`, String(suite.world.locationId));

    const error = (await freeStarts())._unsafeUnwrapErr();

    expect(error.code).toBe(CODES.scheduleTooLarge);
  });
});
