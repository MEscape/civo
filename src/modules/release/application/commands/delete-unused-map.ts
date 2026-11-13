import { combineAsync, errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { releaseMapInUse } from '../../domain/errors/release-errors';
import { parseMapId } from '../../domain/models/ids';

import type { MapRemovalError, MapRemovalGuard } from '../../domain/ports/map-source.port';
import type { DeleteUnusedMapDependencies, ReleaseOperationError } from '../release-dependencies';

export interface DeleteUnusedMapInput {
  readonly websiteId: string;
  readonly id: string;
}

/**
 * Deletes a saved map only while no page places it: neither a saved draft page nor a page of the
 * live release (the public site, where a missing map is an empty block). The map module
 * authorizes the deletion again and asks this guard right before it deletes, so the check cannot
 * be skipped and runs against the stored website of the map, not a request's. The map module's
 * deletion also spends the actor's budget before the guard reads any page, so this command does
 * not count a second time.
 *
 * @audit-exempt The map module records `map.deleted` for the deletion itself; a refusal changes nothing.
 */
export class DeleteUnusedMap {
  constructor(private readonly deps: DeleteUnusedMapDependencies) {}

  execute(
    input: DeleteUnusedMapInput,
  ): AppResultAsync<void, MapRemovalError | ReleaseOperationError> {
    return this.deps.access
      .authorizeWebsite('page.update', input.websiteId)
      .andThen(({ websiteId }) =>
        parseMapId(input.id).asyncAndThen((mapId) =>
          this.deps.maps.deleteMap(websiteId, mapId, this.guard),
        ),
      );
  }

  private readonly guard: MapRemovalGuard = ({ websiteId, mapId }) => {
    const { pages, maps, releases } = this.deps;
    return combineAsync([
      pages.listForRelease(websiteId),
      releases.findPublished(websiteId),
    ] as const).andThen(([drafts, live]) => {
      // An unreadable saved draft cannot prove that deleting its map is safe.
      const hasInvalidDraft = drafts.some((page) => page.status === 'config_invalid');
      const isOnDraft = drafts.some(
        (page) => page.status === 'ready' && maps.mapsInStoredPage(page.config).has(mapId),
      );
      const isOnLive = (live?.snapshot.pages ?? []).some((page) =>
        maps.mapsInStoredPage(page.config).has(mapId),
      );
      return hasInvalidDraft || isOnDraft || isOnLive
        ? errAsync(releaseMapInUse())
        : okAsync(undefined);
    });
  };
}
