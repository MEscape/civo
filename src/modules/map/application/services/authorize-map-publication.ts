import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { mapNotFound } from '../../domain/errors/map-errors';
import { parseMapId } from '../../domain/models/ids';

import type { SavedMap } from '../../domain/models/saved-map';
import type { MapScope } from '../../domain/ports/map-access.port';
import type { SaveMapInput } from '../contracts/saved-map-views';
import type { MapManagementDependencies } from '../map-dependencies';

/** Live map assets need publishing authority for every public change, including withdrawal. */
export function authorizeMapPublication(
  deps: MapManagementDependencies,
  scope: MapScope,
  input: SaveMapInput,
): AppResultAsync<void> {
  const previous: AppResultAsync<SavedMap | null> =
    input.id === undefined
      ? okAsync(null)
      : parseMapId(input.id).asyncAndThen((id) =>
          deps.maps
            .findById(scope.websiteId, id)
            .andThen((map) => (map === null ? errAsync(mapNotFound()) : okAsync(map))),
        );
  return previous.andThen((map) =>
    input.settings.isPublic || map?.settings.isPublic === true
      ? deps.access.authorizeWebsite('release.publish', scope.websiteId).map(() => undefined)
      : okAsync(undefined),
  );
}
