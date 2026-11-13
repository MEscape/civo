import type { AppResultAsync } from '@lib/result';

import type { MapAccessError } from '../../domain/ports/map-access.port';
import type { MapDatasetError } from '../../domain/ports/map-datasets.port';
import type { MapDatasetChoices } from '../contracts/map-reader-views';
import type { MapManagementDependencies } from '../map-dependencies';

export class ListMapDatasets {
  constructor(private readonly deps: MapManagementDependencies) {}

  execute(websiteId: string): AppResultAsync<MapDatasetChoices, MapAccessError | MapDatasetError> {
    return this.deps.access
      .authorizeWebsite('page.read', websiteId)
      .andThen((scope) => this.deps.datasets.listChoices(scope.websiteId));
  }
}
