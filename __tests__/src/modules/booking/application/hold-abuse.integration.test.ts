import { describe, expect, it, vi } from 'vitest';

import type { BookingFlowDependencies } from '@modules/booking/application/booking-dependencies';
import { HOLD_MINUTES } from '@modules/booking/application/booking-limits';
import { HoldSlot } from '@modules/booking/application/commands/hold-slot';
import { BOOKING_RATE_LIMITS } from '@modules/booking/application/rate-limits';
import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';
import { RandomBookingIdentityGenerator } from '@modules/booking/infrastructure/identity/random-booking-identity-generator';
import { prismaBookableResourceRepository } from '@modules/booking/infrastructure/prisma/prisma-bookable-resource.repository';
import { prismaBookableServiceRepository } from '@modules/booking/infrastructure/prisma/prisma-bookable-service.repository';
import { prismaBookingLocationRepository } from '@modules/booking/infrastructure/prisma/prisma-booking-location.repository';
import { prismaBookingRepository } from '@modules/booking/infrastructure/prisma/prisma-booking.repository';
import { prismaWebsiteDirectoryRepository } from '@modules/booking/infrastructure/prisma/prisma-website-directory.repository';

import type { ClientAddressProvider } from '@lib/rate-limit';
import { okAsync } from '@lib/result';
import { SECONDS_PER_MINUTE } from '@lib/utils';

import { UNRESOLVED_CLIENT, clientAt, createTestRateLimiter } from '../../../support/rate-limiting';
import { useWorld } from '../support/persistence-suite';

// A website cap just above one address's budget: under the old budget (12 a minute) one address
// filled it alone.
vi.mock('@modules/booking/application/booking-limits', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  MAX_LIVE_HOLDS_PER_WEBSITE: 12,
}));

const suite = useWorld();

/** One moment for the use case and the limiter: the budget's window does not roll over mid-test. */
const clock = { now: () => new Date('2027-01-10T11:00:00Z') };
let client: ClientAddressProvider = clientAt('198.51.100.1');

const deps: BookingFlowDependencies = {
  bookings: prismaBookingRepository,
  services: prismaBookableServiceRepository,
  resources: prismaBookableResourceRepository,
  locations: prismaBookingLocationRepository,
  websites: prismaWebsiteDirectoryRepository,
  audit: { record: () => undefined },
  clock,
  rateLimiter: createTestRateLimiter(clock),
  notifier: { notify: () => okAsync(undefined) },
  identity: new RandomBookingIdentityGenerator(),
  clientAddress: { current: () => client.current() },
};

const holdSlot = new HoldSlot(deps);

/** The service's starts on Wednesday, 2027-01-13: two employees each, lunch left out. */
const STARTS = ['08', '09', '10', '11', '13', '14', '15', '16'].flatMap((hour) => [
  `${hour}:00`,
  `${hour}:30`,
]);

const hold = (time: string) =>
  holdSlot.execute({
    websiteId: String(suite.world.scope.websiteId),
    serviceId: String(suite.world.serviceId),
    locationId: String(suite.world.locationId),
    start: `2027-01-13T${time}:00+01:00`,
  });

describe('public holds', () => {
  it('counts an address’s holds over a hold’s lifetime', () => {
    expect(BOOKING_RATE_LIMITS.holdClient.windowSeconds).toBe(HOLD_MINUTES * SECONDS_PER_MINUTE);
  });

  it('keeps one address from filling the website’s holds for everyone else', async () => {
    client = clientAt('198.51.100.1');
    const outcomes = [];
    for (const time of STARTS.slice(0, 12)) {
      outcomes.push(await hold(time));
    }
    const held = outcomes.filter((outcome) => outcome.isOk());
    const refused = outcomes.flatMap((outcome) => (outcome.isErr() ? [outcome.error.code] : []));

    expect(held).toHaveLength(BOOKING_RATE_LIMITS.holdClient.limit);
    expect(refused).toEqual([CODES.rateLimited, CODES.rateLimited]);

    client = clientAt('198.51.100.2');
    const other = await hold('16:30');

    expect(other.isOk()).toBe(true);
  });

  it('lets a visitor whose address cannot be determined hold, under the website cap only', async () => {
    client = UNRESOLVED_CLIENT;

    expect((await hold('16:00')).isOk()).toBe(true);
  });
});
