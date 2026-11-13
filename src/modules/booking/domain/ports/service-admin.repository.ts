import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { BookingChange, BookingScope } from './booking.repository';
import type { BookableServiceId, BookingLocationId } from '../models/ids';
import type { ServiceLocationSetting } from '../models/service-location';
import type { NewService, StoredService } from '../models/stored-service';
import type { Instant } from '../time/instant';

/** One service as the list of a location shows it: enough to draw a row, never the whole definition. */
export interface ServiceListEntry {
  readonly id: BookableServiceId;
  readonly name: string;
  readonly category: string | null;
  readonly durationMinutes: number;
  /** The shared definition is switched on. */
  readonly isActive: boolean;
  readonly homeLocationId: BookingLocationId | null;
  readonly copiedFromLocationId: BookingLocationId | null;
  /** How this location has it. */
  readonly setting: Pick<ServiceLocationSetting, 'isActive' | 'isOnlineBookable'>;
}

/** The services of one location, bounded: `isTruncated` says there were more than the bound. */
export interface ServiceListing {
  readonly entries: readonly ServiceListEntry[];
  readonly isTruncated: boolean;
}

/** A service a manager can take over from another location. */
export interface AdoptableService {
  readonly id: BookableServiceId;
  readonly name: string;
  readonly category: string | null;
  readonly durationMinutes: number;
  /** The locations that have it switched on, none of them the one asking. */
  readonly offeredAt: readonly BookingLocationId[];
  readonly homeLocationId: BookingLocationId | null;
}

/** What a change to a stored service changes, each part with the version it was read at. */
export interface ServiceChange {
  /** The shared definition; `null` when only a location's part changes. */
  readonly service: { readonly stored: StoredService; readonly expected: Instant } | null;
  /** One location's part; `null` when only the shared definition changes. */
  readonly setting: {
    readonly serviceId: BookableServiceId;
    readonly stored: ServiceLocationSetting;
    readonly expected: Instant;
  } | null;
  /**
   * Bookings that end with this change (cancelled because the service closes): written in the same
   * transaction, so the service is never switched off with some of them left standing, nor some
   * cancelled with the service still on.
   */
  readonly cancellations: readonly BookingChange[];
  readonly now: Instant;
}

export type ServiceWriteError = ConflictAppError | NotFoundAppError | InfrastructureAppError;

/** Stores what the manager defines: the services of a website and where each is switched on. */
export interface ServiceAdminRepository {
  // @truncation none the returned ServiceListing carries `isTruncated`
  /** The services switched on at `locationId`, by category then name. At most `limit` of them. */
  listAtLocation(
    scope: BookingScope,
    locationId: BookingLocationId,
    limit: number,
  ): AppResultAsync<ServiceListing, InfrastructureAppError>;

  /**
   * Services switched on somewhere else and not at `locationId`, by name. At most `limit` of them.
   * `null` is a location that is not made yet: nothing is taken there, so every service on anywhere is offered.
   */
  listAdoptable(
    scope: BookingScope,
    locationId: BookingLocationId | null,
    limit: number,
  ): AppResultAsync<
    { readonly services: readonly AdoptableService[]; readonly isTruncated: boolean },
    InfrastructureAppError
  >;

  findById(
    scope: BookingScope,
    id: BookableServiceId,
  ): AppResultAsync<StoredService | null, InfrastructureAppError>;

  /** Every service of the website, id and name only, by name. At most `limit` of them; `isTruncated` says there were more. */
  listNames(
    scope: BookingScope,
    limit: number,
  ): AppResultAsync<
    {
      readonly services: ReadonlyArray<{
        readonly id: BookableServiceId;
        readonly name: string;
        readonly category: string | null;
        /** The shared definition is switched on. */
        readonly isActive: boolean;
      }>;
      readonly isTruncated: boolean;
    },
    InfrastructureAppError
  >;

  /** The categories already in use on the website: what a form offers to choose from. */
  listCategories(
    scope: BookingScope,
    limit: number,
  ): AppResultAsync<
    { readonly categories: readonly string[]; readonly isTruncated: boolean },
    InfrastructureAppError
  >;

  /** For each resource, how many services use it somewhere (required or optional). */
  countResourceUse(
    scope: BookingScope,
    limit: number,
  ): AppResultAsync<
    { readonly counts: ReadonlyMap<string, number>; readonly isTruncated: boolean },
    InfrastructureAppError
  >;

  /** A new service and its part at `locationId`, in one transaction. */
  create(
    scope: BookingScope,
    created: {
      readonly service: NewService;
      readonly locationId: BookingLocationId;
      readonly setting: Omit<ServiceLocationSetting, 'locationId'>;
    },
    now: Instant,
  ): AppResultAsync<StoredService, InfrastructureAppError>;

  /** Switches an existing service on at a location; `booking.service_already_offered` when it already is. */
  enable(
    scope: BookingScope,
    request: {
      readonly serviceId: BookableServiceId;
      readonly setting: ServiceLocationSetting;
      readonly now: Instant;
    },
  ): AppResultAsync<StoredService, ServiceWriteError>;

  /**
   * Applies a change: the shared definition and the location's part, each only if it still has the
   * version it was read at, and the bookings that end with it. All or nothing. `booking.service_stale`
   * when somebody else changed a part first.
   */
  save(
    scope: BookingScope,
    change: ServiceChange,
  ): AppResultAsync<StoredService, ServiceWriteError>;
}
