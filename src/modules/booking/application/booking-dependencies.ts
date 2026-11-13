import type { Clock } from '@lib/clock';
import type { ClientAddressProvider, RateLimiter } from '@lib/rate-limit';

import type { ActorMessageRepository } from '../domain/ports/actor-message.repository';
import type { BookableResourceRepository } from '../domain/ports/bookable-resource.repository';
import type { BookableServiceRepository } from '../domain/ports/bookable-service.repository';
import type { BookingAccess } from '../domain/ports/booking-access.port';
import type { BookingAuditLog } from '../domain/ports/booking-audit-log.port';
import type { BookingCatalogRepository } from '../domain/ports/booking-catalog.repository';
import type { BookingIdentityGenerator } from '../domain/ports/booking-identity.port';
import type { BookingLocationRepository } from '../domain/ports/booking-location.repository';
import type { BookingNotifier } from '../domain/ports/booking-notifier.port';
import type { BookingRetentionRepository } from '../domain/ports/booking-retention.repository';
import type { BookingWorkspaceDirectory } from '../domain/ports/booking-workspaces.port';
import type { BookingRepository } from '../domain/ports/booking.repository';
import type { EmployeePreferenceRepository } from '../domain/ports/employee-preference.repository';
import type { LocationAdminRepository } from '../domain/ports/location-admin.repository';
import type { ResourceAdminRepository } from '../domain/ports/resource-admin.repository';
import type { ServiceAdminRepository } from '../domain/ports/service-admin.repository';
import type { TeamDirectory } from '../domain/ports/team-directory.port';
import type { TeamRepository } from '../domain/ports/team.repository';
import type { WebsiteDirectoryRepository } from '../domain/ports/website-directory.repository';

/** What every use case reads the setup and the bookings with. */
interface BookingStores {
  readonly bookings: BookingRepository;
  readonly services: BookableServiceRepository;
  readonly resources: BookableResourceRepository;
  readonly locations: BookingLocationRepository;
  readonly audit: BookingAuditLog;
  readonly clock: Clock;
  readonly rateLimiter: RateLimiter;
  readonly notifier: BookingNotifier;
  readonly identity: BookingIdentityGenerator;
}

/** What every protected booking use case is built from. `access` authorizes the named website in auth. */
export interface BookingDependencies extends BookingStores {
  readonly access: BookingAccess;
  /** What employees would like to do: it orders open bookings and candidates, never more (BD-07). */
  readonly preferences: EmployeePreferenceRepository;
}

/**
 * The public site has no actor, so it gets no authorization service; the tenant comes from the
 * website's own record, and the visitor is told apart by the address the platform reports.
 */
export interface BookingFlowDependencies extends BookingStores {
  readonly websites: WebsiteDirectoryRepository;
  readonly clientAddress: ClientAddressProvider;
}

/** The public catalog: what the flow reads, plus the services and places on offer. */
export interface CatalogDependencies extends BookingFlowDependencies {
  readonly catalog: BookingCatalogRepository;
}

/**
 * What the employee's own area is built from: everything a protected use case has, the inbox, and
 * the two reads that put names and instructions on a booking (the location's name, the service's
 * name, documents and instructions). Names are tenant data: they go into views, never into logs.
 */
export interface EmployeeAreaDependencies extends BookingDependencies {
  readonly messages: ActorMessageRepository;
  readonly locationAdmin: Pick<LocationAdminRepository, 'list'>;
  readonly serviceAdmin: Pick<ServiceAdminRepository, 'findById' | 'listAtLocation' | 'listNames'>;
}

/**
 * What the administration of locations is built from: who may (access), the limiter, the
 * clock and the audit sink every protected use case has, the locations it reads and writes, and the
 * two reads of bookings it needs to say what a change would affect. It cannot write a booking: a
 * change of a location never cancels or moves one.
 */
export interface LocationAdminDependencies extends Pick<
  BookingDependencies,
  'access' | 'clock' | 'rateLimiter'
> {
  readonly audit: BookingAuditLog;
  readonly locations: LocationAdminRepository;
  readonly bookings: Pick<BookingRepository, 'list' | 'count'>;
}

/**
 * What the administration of services is built from: who may (access), the limiter, the
 * clock, the audit sink and the notifier every protected use case has, the services it reads and
 * writes, the locations and resources it names, and the bookings it has to count or end. Ending a
 * booking goes through the services' own transaction, so the bookings are only read here.
 */
export interface ServiceAdminDependencies extends Pick<
  BookingDependencies,
  'access' | 'clock' | 'rateLimiter' | 'notifier'
> {
  readonly audit: BookingAuditLog;
  readonly services: ServiceAdminRepository;
  readonly locations: Pick<LocationAdminRepository, 'findById' | 'list'>;
  readonly resources: Pick<BookableResourceRepository, 'list'>;
  readonly bookings: Pick<BookingRepository, 'list' | 'count'>;
}

/**
 * What the administration of physical resources is built from: who may, the limiter, the clock and
 * the audit sink every protected use case has, the resources it reads and writes, the location each
 * belongs to (its hours and its clock), and the reads of bookings it needs to show how a resource is
 * used and what a change would affect. It cannot write a booking: a change of a resource never
 * cancels or moves one.
 */
export interface ResourceAdminDependencies extends Pick<
  BookingDependencies,
  'access' | 'clock' | 'rateLimiter'
> {
  readonly audit: BookingAuditLog;
  readonly resources: ResourceAdminRepository;
  readonly locations: Pick<LocationAdminRepository, 'findById'>;
  readonly bookings: Pick<BookingRepository, 'list' | 'listBlocking'>;
}

/**
 * What the team is built from: who may, the limiter, the clock and the audit sink every protected
 * use case has, the calendars it reads and writes, the member directory (who holds the role
 * `employee`, and their names), each calendar's location (its hours and its clock), and the reads of
 * bookings a change of hours could affect. It writes a booking only to take the employee off it (`withdrawFromBookings`).
 */
export interface TeamDependencies extends Pick<
  BookingDependencies,
  'access' | 'clock' | 'rateLimiter'
> {
  readonly audit: BookingAuditLog;
  readonly team: TeamRepository;
  readonly directory: TeamDirectory;
  readonly locations: Pick<LocationAdminRepository, 'findById' | 'list'>;
  readonly bookings: Pick<BookingRepository, 'list' | 'findById' | 'save'>;
}

/** What keeping the module's data to its retention is built from. */
export interface BookingRetentionDependencies {
  readonly retention: BookingRetentionRepository;
  readonly clock: Clock;
  /** How many days after an appointment ended its booking is kept; validated configuration. */
  readonly retentionDays: number;
}

/** What the list of the websites a person works in through bookings is built from. */
export interface WorkspaceDependencies {
  readonly workspaces: BookingWorkspaceDirectory;
}
