import { errAsync, okAsync, ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { fromRateLimitFailure, mapInvalidInput } from '../../domain/errors/map-errors';
import { isMapBounds } from '../../domain/models/saved-map';
import { MAP_RATE_LIMITS } from '../rate-limits';
import { loadMapWindow } from '../services/load-map-window';

import type { Bounds } from '../../domain/geo/geometry';
import type { MapModel } from '../contracts/map-views';
import type { InlineMapDependencies, MapOperationError } from '../map-dependencies';

/**
 * @authorization public A signed published configuration names the only readable datasets; signed drafts independently require page.read.
 */
export class ReadInlineMapWindow {
  constructor(private readonly deps: InlineMapDependencies) {}

  execute(input: {
    readonly token: string;
    readonly bounds: Bounds;
  }): AppResultAsync<MapModel, MapOperationError> {
    return ResultAsync.fromSafePromise(this.deps.clientAddress.current())
      .andThen((client) =>
        this.deps.rateLimiter.enforce({ policy: MAP_RATE_LIMITS.readWindow, subject: client }),
      )
      .mapErr(fromRateLimitFailure)
      .andThen(() => {
        if (!isMapBounds(input.bounds)) {
          return errAsync(mapInvalidInput());
        }
        return this.deps.tokens.read(input.token).asyncAndThen((definition) =>
          (definition.mode === 'draft'
            ? this.deps.access
                .authorizeWebsite('page.read', definition.websiteId)
                .map(() => undefined)
            : okAsync(undefined)
          ).andThen(() =>
            loadMapWindow(
              this.deps,
              {
                websiteId: definition.websiteId,
                name: definition.draft.name,
                settings: definition.draft.settings,
              },
              input.bounds,
            ),
          ),
        );
      });
  }
}
