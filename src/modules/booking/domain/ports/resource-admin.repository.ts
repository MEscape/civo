import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { BookingScope } from './booking.repository';
import type { BookableResource, ResourceKind } from '../models/bookable-resource';
import type { BookableResourceId, BookableServiceId, BookingLocationId } from '../models/ids';
import type { Instant } from '../time/instant';

/** The kinds the administration of resources looks after: everything but a person's calendar. */
export type PhysicalResourceKind = Exclude<ResourceKind, 'employee'>;

/**
 * A physical resource (room, desk, device) as the administration reads and writes it: what the
 * rules read, one location, and a note for the managers. `updatedAt` is the version a change names.
 */
export interface StoredResource extends Omit<
  BookableResource,
  'skills' | 'type' | 'locationId' | 'coverage'
> {
  readonly type: PhysicalResourceKind;
  readonly locationId: BookingLocationId;
  readonly internalNote: string | null;
  readonly updatedAt: Instant;
}

/** A resource about to be stored: the repository gives it its id and its first version. */
export type NewResource = Omit<StoredResource, 'id' | 'updatedAt'>;

export interface ResourceAdminListQuery {
  readonly locationId: BookingLocationId;
  /** Part of the name, any case. */
  readonly search?: string | undefined;
  readonly type?: PhysicalResourceKind | undefined;
  /** Required: no list is unbounded. */
  readonly limit: number;
  readonly offset: number;
}

/** A service that uses a resource at its location, and whether it needs it. */
export interface ResourceUser {
  readonly resourceId: BookableResourceId;
  readonly serviceId: BookableServiceId;
  readonly serviceName: string;
  readonly isRequired: boolean;
}

/** A change to a stored resource: what it becomes, and the version it was read at. */
export interface ResourceChange {
  readonly stored: StoredResource;
  readonly expected: Instant;
  readonly now: Instant;
}

export type ResourceWriteError = ConflictAppError | NotFoundAppError | InfrastructureAppError;

/**
 * Lists, reads and writes the physical resources of one location. Employees are not here: a
 * person's calendar is set up with the team. A resource of another website or location is `null`;
 * every statement is pinned to the scope. A save changes the row only if it still has the version
 * it was read at (one `UPDATE … WHERE`); its kind and location never change, because the units of
 * existing bookings and the services that use it depend on both. Resources are never deleted.
 */
export interface ResourceAdminRepository {
  count(
    scope: BookingScope,
    query: ResourceAdminListQuery,
  ): AppResultAsync<number, InfrastructureAppError>;

  /** By name, then id. */
  list(
    scope: BookingScope,
    query: ResourceAdminListQuery,
  ): AppResultAsync<readonly StoredResource[], InfrastructureAppError>;

  findById(
    scope: BookingScope,
    id: BookableResourceId,
  ): AppResultAsync<StoredResource | null, InfrastructureAppError>;

  /** The services switched on at `locationId` that use one of its resources; at most `limit` services are read, and `isTruncated` says there were more. */
  listUsers(
    scope: BookingScope,
    locationId: BookingLocationId,
    limit: number,
  ): AppResultAsync<
    { readonly users: readonly ResourceUser[]; readonly isTruncated: boolean },
    InfrastructureAppError
  >;

  create(
    scope: BookingScope,
    resource: NewResource,
    now: Instant,
  ): AppResultAsync<StoredResource, InfrastructureAppError>;

  /** `booking.resource_stale` when the resource moved on since it was read. */
  save(
    scope: BookingScope,
    change: ResourceChange,
  ): AppResultAsync<StoredResource, ResourceWriteError>;
}
