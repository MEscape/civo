import type { Actor } from '@modules/auth';
import type {
  BookingDependencies,
  BookingFlowDependencies,
} from '@modules/booking/application/booking-dependencies';
import type { BookableResource } from '@modules/booking/domain/models/bookable-resource';
import type { BookableService } from '@modules/booking/domain/models/bookable-service';
import type { BookingLocation } from '@modules/booking/domain/models/booking-location';
import { toWebsiteId } from '@modules/booking/domain/models/ids';
import type { AddressSearch } from '@modules/booking/domain/ports/address-search.port';

import { clientAt, createTestRateLimiter } from '../../../support/rate-limiting';

import {
  InMemoryBookingRepository,
  InMemoryLocationRepository,
  InMemoryResourceRepository,
  InMemoryServiceRepository,
  InMemoryWebsiteDirectory,
  ManualClock,
  OTHER_TENANT,
  RecordingAuditLog,
  RecordingNotifier,
  SequentialReferences,
  authorizationFor,
} from './fakes';
import { NOW, TENANT, WEBSITE, makeLocation, makeResource, makeService } from './fixtures';

export const OTHER_WEBSITE = toWebsiteId('website-2');

/** The address every visitor of a test world comes from. */
export const VISITOR_ADDRESS = '203.0.113.7';

interface WorldOptions {
  readonly service?: BookableService;
  readonly location?: BookingLocation;
  readonly resources?: readonly BookableResource[];
  readonly actor?: Actor | null;
  readonly addresses?: AddressSearch | null;
}

/**
 * One website with a location, a service and its resources, plus a second
 * website of ANOTHER tenant with a service of its own, so every test can also
 * check that nothing leaks across tenants.
 */
export function createWorld(options: WorldOptions = {}) {
  const clock = new ManualClock(NOW);
  const audit = new RecordingAuditLog();
  const notifier = new RecordingNotifier();
  const locations = new InMemoryLocationRepository();
  const resources = new InMemoryResourceRepository();
  const services = new InMemoryServiceRepository();
  const bookings = new InMemoryBookingRepository(resources);

  locations.seed(options.location ?? makeLocation());
  for (const resource of options.resources ?? [makeResource('emp-1')]) {
    resources.seed(resource);
  }
  services.seed(options.service ?? makeService());

  // Another tenant's website, with a service that must never be visible here.
  services.seed(
    makeService({
      id: 'foreign-service' as BookableService['id'],
      tenantId: OTHER_TENANT,
      websiteId: OTHER_WEBSITE,
      name: 'Foreign service',
    }),
  );

  const websites = new InMemoryWebsiteDirectory(
    new Map([
      [WEBSITE, TENANT],
      [OTHER_WEBSITE, OTHER_TENANT],
    ]),
  );

  const rateLimiter = createTestRateLimiter(clock);

  const flow: BookingFlowDependencies = {
    rateLimiter,
    clientAddress: clientAt(VISITOR_ADDRESS),
    websites,
    locations,
    resources,
    services,
    bookings,
    clock,
    references: new SequentialReferences(),
    audit,
    notifier,
  };

  const admin: BookingDependencies = {
    authorization: authorizationFor(options.actor ?? null),
    locations,
    resources,
    services,
    bookings,
    audit,
    addresses: options.addresses ?? null,
    rateLimiter,
    notifier,
    clock,
  };

  return { clock, audit, notifier, locations, resources, services, bookings, flow, admin };
}

export type World = ReturnType<typeof createWorld>;
