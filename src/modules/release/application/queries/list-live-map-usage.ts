import type { AppResultAsync } from '@lib/result';

import type { ReleaseReadError } from '../../domain/ports/release.repository';
import type { LiveMapUsageView } from '../contracts/usage-views';
import type { DeleteUnusedMapDependencies, ReleaseOperationError } from '../release-dependencies';

/**
 * Which pages of the live site place each saved map, so the maps screen can say that deleting one
 * would empty a block of the public site until the next publish. Empty for a website that was
 * never published.
 */
export class ListLiveMapUsage {
  constructor(private readonly deps: DeleteUnusedMapDependencies) {}

  execute(
    rawWebsiteId: string,
  ): AppResultAsync<LiveMapUsageView, ReleaseOperationError | ReleaseReadError> {
    return this.deps.access
      .authorizeWebsite('release.read', rawWebsiteId)
      .andThen(({ websiteId }) =>
        this.deps.releases.findPublished(websiteId).map((live) => {
          const usage: Record<string, Array<{ path: string; title: string }>> = {};
          for (const page of live?.snapshot.pages ?? []) {
            this.deps.maps.mapsInStoredPage(page.config).forEach((mapId) => {
              (usage[mapId] ??= []).push({ path: page.path, title: page.title });
            });
          }
          return usage;
        }),
      );
  }
}
