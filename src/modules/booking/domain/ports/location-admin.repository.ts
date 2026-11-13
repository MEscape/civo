import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { BookingScope } from './booking.repository';
import type { BookingLocationId } from '../models/ids';
import type { AvailabilityPlan } from '../scheduling/availability-plan';
import type { Instant } from '../time/instant';
import type { TimeZone } from '../time/time-zone';

/**
 * A location as the administration reads and writes it. `updatedAt` is the version: a change names
 * the one it was read at and is refused if somebody else wrote since.
 */
export interface StoredLocation {
  readonly id: BookingLocationId;
  readonly name: string;
  readonly address: string | null;
  readonly zone: TimeZone;
  /** Switched off completely. A location that works but takes no online bookings is not modelled yet (BD-12). */
  readonly isActive: boolean;
  readonly openingHours: AvailabilityPlan;
  readonly updatedAt: Instant;
}

/** A location about to be stored: the repository gives it its id and its first version. */
export type NewLocation = Omit<StoredLocation, 'id' | 'updatedAt'>;

export interface LocationListQuery {
  /** Part of the name, any case. */
  readonly search?: string | undefined;
  readonly isActive?: boolean | undefined;
  /** Required: no list is unbounded. */
  readonly limit: number;
  readonly offset: number;
}

/** A change to a stored location: what it becomes, and the version it was read at. */
export interface LocationChange {
  readonly stored: StoredLocation;
  readonly expected: Instant;
  readonly now: Instant;
}

export type LocationWriteError = ConflictAppError | NotFoundAppError | InfrastructureAppError;

/**
 * Lists, reads and writes the locations of one website. A location of another website is `null` or
 * not found, never a trust decision: every statement is pinned to the scope. A write changes the row
 * only if it still has the version it was read at (one `UPDATE … WHERE`), so two managers cannot
 * silently overwrite each other. Locations are never deleted, only switched off.
 */
export interface LocationAdminRepository {
  count(
    scope: BookingScope,
    query: LocationListQuery,
  ): AppResultAsync<number, InfrastructureAppError>;

  list(
    scope: BookingScope,
    query: LocationListQuery,
  ): AppResultAsync<readonly StoredLocation[], InfrastructureAppError>;

  findById(
    scope: BookingScope,
    id: BookingLocationId,
  ): AppResultAsync<StoredLocation | null, InfrastructureAppError>;

  create(
    scope: BookingScope,
    location: NewLocation,
    now: Instant,
  ): AppResultAsync<StoredLocation, InfrastructureAppError>;

  /** `booking.location_stale` when the location moved on since it was read. */
  save(
    scope: BookingScope,
    change: LocationChange,
  ): AppResultAsync<StoredLocation, LocationWriteError>;
}
