import type { ActorId } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { BookingScope } from './booking.repository';
import type { BookableResource, ResourceKind } from '../models/bookable-resource';
import type { BookableResourceId, BookingLocationId } from '../models/ids';

export interface ResourceListQuery {
  /** The resources that can serve this location: its own, and those that serve every location. */
  readonly servingLocationId?: BookingLocationId;
  readonly types?: readonly ResourceKind[];
  /** Required: no list is unbounded. */
  readonly limit: number;
}

/**
 * Read-only access to the resources of a website (employees, rooms, desks, devices), reduced to
 * what the booking rules read. Their calendars (working hours) are not read here: the shape the
 * administration stores them in is decided with it. Answers `null` or an empty list for another
 * website's resources.
 */
export interface BookableResourceRepository {
  findById(
    scope: BookingScope,
    id: BookableResourceId,
  ): AppResultAsync<BookableResource | null, InfrastructureAppError>;

  /** The resource that is this member's calendar, if the member has one. */
  findEmployeeOf(
    scope: BookingScope,
    actorId: ActorId,
  ): AppResultAsync<BookableResource | null, InfrastructureAppError>;

  /** Active and inactive alike, ordered by id. */
  list(
    scope: BookingScope,
    query: ResourceListQuery,
  ): AppResultAsync<readonly BookableResource[], InfrastructureAppError>;
}
