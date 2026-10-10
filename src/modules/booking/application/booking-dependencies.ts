import type { AuthorizationService } from '@modules/auth';

import type { Clock } from '@lib/clock';

import type { BookableResourceRepository } from '../domain/ports/bookable-resource.repository';
import type { BookableServiceRepository } from '../domain/ports/bookable-service.repository';
import type { BookingAuditLog } from '../domain/ports/booking-audit-log.port';
import type { BookingLocationRepository } from '../domain/ports/booking-location.repository';
import type { BookingReferenceGenerator } from '../domain/ports/booking-reference-generator.port';
import type { BookingRepository } from '../domain/ports/booking.repository';
import type { RequestLimiter } from '../domain/ports/request-limiter.port';
import type { WebsiteDirectoryRepository } from '../domain/ports/website-directory.repository';

/** What every protected booking use case is built from (the admin side). */
export interface BookingDependencies {
  readonly authorization: AuthorizationService;
  readonly locations: BookingLocationRepository;
  readonly resources: BookableResourceRepository;
  readonly services: BookableServiceRepository;
  readonly bookings: BookingRepository;
  readonly audit: BookingAuditLog;
  readonly clock: Clock;
}

/**
 * What the public read side is built from. There is no actor, so no
 * authorization service; the website directory resolves the tenant from the
 * website instead, and every later read is scoped by it.
 */
export interface PublicBookingDependencies {
  readonly websites: WebsiteDirectoryRepository;
  readonly locations: BookingLocationRepository;
  readonly resources: BookableResourceRepository;
  readonly services: BookableServiceRepository;
  readonly bookings: BookingRepository;
  readonly clock: Clock;
}

/**
 * What the public booking commands (hold, confirm, cancel, move) are built
 * from: the public read side plus an audit log and the reference generator.
 * Commands are always audited, so they never take the plain public set.
 */
export interface BookingFlowDependencies extends PublicBookingDependencies {
  readonly references: BookingReferenceGenerator;
  readonly audit: BookingAuditLog;
}

/** What the request budget is built from: a limiter and the clock it counts time with. */
export interface RequestBudgetDependencies {
  readonly limiter: RequestLimiter;
  readonly clock: Clock;
}
