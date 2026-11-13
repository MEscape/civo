import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { mapInvalidInput } from '../../domain/errors/map-errors';
import { parseMapId } from '../../domain/models/ids';
import { createSavedMapDraft } from '../../domain/models/saved-map';
import { toSavedMapView } from '../map-view-mappers';
import { MAP_RATE_LIMITS } from '../rate-limits';
import { authorizeMapPublication } from '../services/authorize-map-publication';

import type { SavedMapView, SaveMapInput } from '../contracts/saved-map-views';
import type { MapManagementDependencies, MapOperationError } from '../map-dependencies';

/** Creates or replaces one map configuration; writes use optimistic concurrency and audit only after success. */
export class SaveMap {
  constructor(private readonly deps: MapManagementDependencies) {}

  execute(input: SaveMapInput): AppResultAsync<SavedMapView, MapOperationError> {
    return this.deps.access.authorizeWebsite('page.update', input.websiteId).andThen((scope) =>
      authorizeMapPublication(this.deps, scope, input)
        .andThen(() =>
          this.deps.rateLimiter.enforce({
            policy: MAP_RATE_LIMITS.save,
            subject: { kind: 'actor', tenantId: scope.websiteId, actorId: scope.actorId },
          }),
        )
        .andThen(() => createSavedMapDraft(input))
        .andThen((draft) =>
          this.deps.datasets.validateLayers(scope.websiteId, draft.settings.layers).andThen(() => {
            if (input.id === undefined) {
              return this.deps.maps.create(scope.websiteId, draft);
            }
            if (
              !Number.isSafeInteger(input.version) ||
              input.version === undefined ||
              input.version < 1
            ) {
              return errAsync(mapInvalidInput());
            }
            const version = input.version;
            return parseMapId(input.id).asyncAndThen((id) =>
              this.deps.maps.update({ websiteId: scope.websiteId, id, version, draft }),
            );
          }),
        )
        .map((saved) => {
          const event = {
            actorId: scope.actorId,
            websiteId: scope.websiteId,
            mapId: saved.id,
            version: saved.version,
          };
          if (input.id === undefined) {
            this.deps.audit.record({ type: 'map.created', ...event });
          } else {
            this.deps.audit.record({ type: 'map.updated', ...event });
          }
          return toSavedMapView(saved);
        }),
    );
  }
}
