import type { InfrastructureAppError } from '@lib/errors';
import { loadClampedPage, resolvePageRequest } from '@lib/pagination';
import type { PageRequest, Page } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import { MAP_LIST_LIMITS } from '../map-limits';
import { toSavedMapView } from '../map-view-mappers';

import type { MapAccessError } from '../../domain/ports/map-access.port';
import type { SavedMapView } from '../contracts/saved-map-views';
import type { MapManagementDependencies } from '../map-dependencies';

export class ListSavedMaps {
  constructor(private readonly deps: MapManagementDependencies) {}

  execute(
    websiteId: string,
    request: PageRequest,
  ): AppResultAsync<Page<SavedMapView>, MapAccessError | InfrastructureAppError> {
    return this.deps.access
      .authorizeWebsite('page.read', websiteId)
      .andThen((scope) =>
        loadClampedPage(resolvePageRequest(request, MAP_LIST_LIMITS), (page) =>
          this.deps.maps.list(scope.websiteId, page),
        ).map((page) => ({ ...page, items: page.items.map(toSavedMapView) })),
      );
  }
}
