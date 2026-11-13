import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { mapInvalidInput } from '../../domain/errors/map-errors';
import { createSavedMapDraft, isMapBounds } from '../../domain/models/saved-map';
import { MAP_RATE_LIMITS } from '../rate-limits';
import { loadMapWindow } from '../services/load-map-window';

import type { Bounds } from '../../domain/geo/geometry';
import type { SavedMapDraft } from '../../domain/models/saved-map';
import type { MapModel } from '../contracts/map-views';
import type { MapManagementDependencies, MapOperationError } from '../map-dependencies';

/** Preview unsaved settings without making their datasets publicly reachable. */
export class PreviewMapWindow {
  constructor(private readonly deps: MapManagementDependencies) {}

  execute(input: {
    readonly websiteId: string;
    readonly draft: SavedMapDraft;
    readonly bounds: Bounds;
  }): AppResultAsync<MapModel, MapOperationError> {
    return this.deps.access.authorizeWebsite('page.read', input.websiteId).andThen((scope) =>
      this.deps.rateLimiter
        .enforce({
          policy: MAP_RATE_LIMITS.readWindow,
          subject: { kind: 'actor', tenantId: scope.websiteId, actorId: scope.actorId },
        })
        .andThen(() => {
          if (!isMapBounds(input.bounds)) {
            return errAsync(mapInvalidInput());
          }
          return createSavedMapDraft(input.draft).asyncAndThen((draft) =>
            loadMapWindow(
              this.deps,
              {
                name: draft.name,
                settings: draft.settings,
                websiteId: scope.websiteId,
              },
              input.bounds,
            ),
          );
        }),
    );
  }
}
