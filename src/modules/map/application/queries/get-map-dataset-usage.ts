import type { InfrastructureAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { unique } from '@lib/utils';

import { mapSourceFailed } from '../../domain/errors/map-errors';
import { SAVED_MAP_LIMITS } from '../../domain/models/saved-map';

import type { MapAccessError } from '../../domain/ports/map-access.port';
import type { MapManagementDependencies } from '../map-dependencies';

/** All saved configurations retain their sources, including private maps not yet placed on a page. */
export class GetMapDatasetUsage {
  constructor(private readonly deps: MapManagementDependencies) {}

  execute(
    websiteId: string,
  ): AppResultAsync<
    { readonly datasetIds: readonly string[] },
    MapAccessError | InfrastructureAppError
  > {
    return this.deps.access.authorizeWebsite('page.read', websiteId).andThen((scope) =>
      this.deps.maps
        .list(scope.websiteId, { page: 1, pageSize: SAVED_MAP_LIMITS.mapsPerWebsite })
        .andThen((page) =>
          // Out-of-band writers exceeding the cap must not make a deletion check incomplete.
          page.total > page.items.length
            ? errAsync(mapSourceFailed())
            : okAsync({
                datasetIds: unique(
                  page.items.flatMap((map) => map.settings.layers.map((layer) => layer.datasetId)),
                ),
              }),
        ),
    );
  }
}
