import type { AuthorizationError } from '@modules/auth';

import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  UnexpectedAppError,
  ValidationAppError,
} from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { MapId, WebsiteId } from '../models/ids';
import type { PublishableMap } from '../publishing/publishable';

/** A guard failure the map module understands: its own refusals, or the guard's conflict. */
export type MapRemovalError =
  | AuthorizationError
  | ValidationAppError
  | NotFoundAppError
  | ConflictAppError
  | InfrastructureAppError
  | UnexpectedAppError;

/** Asked right before a map is deleted; a conflict keeps it. */
export type MapRemovalGuard = (scope: {
  readonly websiteId: WebsiteId;
  readonly mapId: MapId;
}) => AppResultAsync<void, MapRemovalGuardError>;

export type MapRemovalGuardError =
  ConflictAppError | InfrastructureAppError | UnexpectedAppError | AuthorizationError;

/**
 * The release module's only view of a website's saved maps. The map module owns their storage and
 * their shape; a release freezes what it reads and never decides what a valid map is.
 */
export interface MapSource {
  /** Every saved map with its current settings, for publishing. */
  listForRelease(
    websiteId: WebsiteId,
  ): AppResultAsync<readonly PublishableMap[], InfrastructureAppError>;
  /** The saved maps a stored page (a snapshot page or a draft) places. */
  mapsInStoredPage(stored: unknown): ReadonlySet<string>;
  /** The datasets a frozen map reads. */
  datasetsOfMap(map: PublishableMap): ReadonlySet<string>;
  deleteMap(
    websiteId: WebsiteId,
    mapId: MapId,
    guard: MapRemovalGuard,
  ): AppResultAsync<void, MapRemovalError>;
}
