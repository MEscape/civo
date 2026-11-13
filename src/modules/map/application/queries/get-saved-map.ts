import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { mapNotFound } from '../../domain/errors/map-errors';
import { parseMapId } from '../../domain/models/ids';
import { toSavedMapView } from '../map-view-mappers';

import type { MapAccessError } from '../../domain/ports/map-access.port';
import type { SavedMapView } from '../contracts/saved-map-views';
import type { MapManagementDependencies } from '../map-dependencies';

export class GetSavedMap {
  constructor(private readonly deps: MapManagementDependencies) {}

  execute(
    websiteId: string,
    rawId: string,
  ): AppResultAsync<SavedMapView, MapAccessError | NotFoundAppError | InfrastructureAppError> {
    return this.deps.access.authorizeWebsite('page.read', websiteId).andThen((scope) =>
      parseMapId(rawId)
        .asyncAndThen((id) => this.deps.maps.findById(scope.websiteId, id))
        .andThen((map) => (map === null ? errAsync(mapNotFound()) : okAsync(toSavedMapView(map)))),
    );
  }
}
