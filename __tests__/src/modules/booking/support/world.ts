import type { Actor } from '@modules/auth';
import type {
  BookingDependencies,
  BookingFlowDependencies,
} from '@modules/booking/application/booking-dependencies';
import type { BookableResource } from '@modules/booking/domain/models/bookable-resource';
import type { BookableService } from '@modules/booking/domain/models/bookable-service';
import type { BookingLocation } from '@modules/booking/domain/models/booking-location';
import { toWebsiteId } from '@modules/booking/domain/models/ids';

import {
  InMemoryBookingRepository,
  InMemoryLocationRepository,
  InMemoryResourceRepository,
  InMemoryServiceRepository,
  InMemoryWebsiteDirectory,
  ManualClock,
  OTHER_TENANT,
  RecordingAuditLog,
  SequentialReferences,
  authorizationFor,
} from './fakes';
import { NOW, TENANT, WEBSITE, makeLocation, makeResource, makeService } from './fixtures';

export const OTHER_WEBSITE = toWebsiteId('website-2');

interface WorldOptions {
  readonly service?: BookableService;
  readonly location?: BookingLocation;
  readonly resources?: readonly BookableResource[];
  readonly actor?: Actor | null;
}

/**
 * One website with a location, a service and its resources, plus a second
 * website of ANOTHER tenant with a service of its own, so every test can also
 * check that nothing leaks across tenants.
 */
export function createWorld(options: WorldOptions = {}) {
  const clock = new ManualClock(NOW);
  const audit = new RecordingAuditLog();
  const locations = new InMemoryLocationRepository();
  const resources = new InMemoryResourceRepository();
  const services = new InMemoryServiceRepository();
  const bookings = new InMemoryBookingRepository();

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

  const flow: BookingFlowDependencies = {
    websites,
    locations,
    resources,
    services,
    bookings,
    clock,
    references: new SequentialReferences(),
    audit,
  };

  const admin: BookingDependencies = {
    authorization: authorizationFor(options.actor ?? null),
    locations,
    resources,
    services,
    bookings,
    audit,
    clock,
  };

  return { clock, audit, locations, resources, services, bookings, flow, admin };
}

export type World = ReturnType<typeof createWorld>;
