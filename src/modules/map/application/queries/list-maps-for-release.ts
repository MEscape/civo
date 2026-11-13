import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { mapSourceFailed } from '../../domain/errors/map-errors';
import { parseWebsiteId } from '../../domain/models/ids';
import { MAP_LIMITS } from '../map-limits';
import { toSavedMapView } from '../map-view-mappers';

import type { SavedMapView } from '../contracts/saved-map-views';
import type { MapReleaseDependencies } from '../map-dependencies';

/**
 * Every saved map of a website, for freezing into a release. It has no actor: the release module
 * authorizes the publish first and passes the website of a stored record.
 *
 * @authorization public Trusted module-to-module reader; the caller authorizes the website before asking.
 * @rate-limit none Reads at most one bounded page, and only inside an authorized publish.
 */
export class ListMapsForRelease {
  constructor(private readonly deps: MapReleaseDependencies) {}

  execute(
    rawWebsiteId: string,
  ): AppResultAsync<readonly SavedMapView[], InfrastructureAppError | ValidationAppError> {
    return parseWebsiteId(rawWebsiteId).asyncAndThen((websiteId) =>
      this.deps.maps
        .list(websiteId, { page: 1, pageSize: MAP_LIMITS.mapsPerWebsite })
        .mapErr(mapSourceFailed)
        // A publish that silently left maps out would freeze a site with broken maps.
        .andThen((page) =>
          page.total > page.items.length
            ? errAsync(mapSourceFailed())
            : okAsync(page.items.map(toSavedMapView)),
        ),
    );
  }
}
