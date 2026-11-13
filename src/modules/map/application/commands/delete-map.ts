import type { AuthorizationError } from '@modules/auth';

import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  UnexpectedAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { mapNotFound } from '../../domain/errors/map-errors';
import { parseMapId } from '../../domain/models/ids';
import { MAP_RATE_LIMITS } from '../rate-limits';

import type { MapId, WebsiteId } from '../../domain/models/ids';
import type { MapManagementDependencies } from '../map-dependencies';

/** Why a guard keeps a map: a page still places it, or the pages could not be read. */
export type MapDeletionGuardError =
  ConflictAppError | InfrastructureAppError | UnexpectedAppError | AuthorizationError;

/**
 * Asked right before a map is deleted; a failure keeps it. The map cannot see the pages that
 * place it, so whoever can (the release module) answers.
 */
export type MapDeletionGuard = (scope: {
  readonly websiteId: WebsiteId;
  readonly mapId: MapId;
}) => AppResultAsync<void, MapDeletionGuardError>;

export interface DeleteMapInput {
  readonly websiteId: string;
  readonly id: string;
  /** Answers whether a page still places the map. */
  readonly guard: MapDeletionGuard;
}

export type DeleteMapError =
  MapDeletionGuardError | ValidationAppError | NotFoundAppError | RateLimitedAppError;

/**
 * Deletes one saved map, but only when the guard allows it. A public map is a live asset: removing
 * it withdraws it, which needs publishing authority exactly like editing or withdrawing it does.
 * Written once the map is gone, so a refused or failed deletion leaves no trace in the audit trail.
 */
export class DeleteMap {
  constructor(private readonly deps: MapManagementDependencies) {}

  execute(input: DeleteMapInput): AppResultAsync<void, DeleteMapError> {
    return this.deps.access.authorizeWebsite('page.update', input.websiteId).andThen((scope) =>
      this.deps.rateLimiter
        .enforce({
          policy: MAP_RATE_LIMITS.delete,
          subject: { kind: 'actor', tenantId: scope.websiteId, actorId: scope.actorId },
        })
        .andThen(() =>
          parseMapId(input.id).asyncAndThen((mapId) =>
            this.deps.maps.findById(scope.websiteId, mapId).andThen((map) => {
              if (map === null) {
                return errAsync(mapNotFound());
              }
              const publication: AppResultAsync<unknown, DeleteMapError> = map.settings.isPublic
                ? this.deps.access.authorizeWebsite('release.publish', scope.websiteId)
                : okAsync(undefined);
              return publication
                .andThen(() => input.guard({ websiteId: scope.websiteId, mapId }))
                .andThen(() => this.deps.maps.delete(scope.websiteId, mapId))
                .map(() => {
                  this.deps.audit.record({
                    type: 'map.deleted',
                    actorId: scope.actorId,
                    websiteId: scope.websiteId,
                    mapId,
                  });
                });
            }),
          ),
        ),
    );
  }
}
