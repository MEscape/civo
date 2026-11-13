import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  UnexpectedAppError,
  ValidationAppError,
} from '@lib/errors';
import type { ClientAddressProvider, RateLimiter } from '@lib/rate-limit';

import type { InlineMapToken } from '../domain/ports/inline-map-token.port';
import type { MapAccess, MapAccessError } from '../domain/ports/map-access.port';
import type { MapAuditLog } from '../domain/ports/map-audit-log.port';
import type { MapDatasets } from '../domain/ports/map-datasets.port';
import type { SavedMapRepository } from '../domain/ports/saved-map.repository';

/** What the map's use cases are built from. */
export interface MapDependencies {
  /** Where "some features were left out" is recorded, next to the rest of the module's events. */
  readonly audit: MapAuditLog;
}

export interface MapManagementDependencies extends MapDependencies {
  readonly access: MapAccess;
  readonly maps: SavedMapRepository;
  readonly datasets: MapDatasets;
  readonly rateLimiter: RateLimiter;
}

/** What a trusted module-to-module reader of the saved maps needs. */
export type MapReleaseDependencies = Pick<MapManagementDependencies, 'maps'>;

export interface MapWindowDependencies extends MapManagementDependencies {
  readonly clientAddress: ClientAddressProvider;
}

/** The key that signs and reads an inline map's configuration. */
export interface MapTokenDependencies {
  readonly tokens: InlineMapToken;
}

/** What the inline map reader is built from: the window dependencies and the token key. */
export interface InlineMapDependencies extends MapWindowDependencies, MapTokenDependencies {}

/** Everything a map operation can fail with: access, lookup, limits, conflicts and storage. */
export type MapOperationError =
  | MapAccessError
  | ConflictAppError
  | NotFoundAppError
  | RateLimitedAppError
  | ValidationAppError
  | UnexpectedAppError
  | InfrastructureAppError;
