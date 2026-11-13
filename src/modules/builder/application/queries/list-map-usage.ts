import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { parseWebsiteId } from '../../domain/models/ids';
import { mapsAwaitingChoiceOf, savedMapUsesOf } from '../../domain/models/page-dataset-usage';
import { readWebsitePages } from '../services/read-website-pages';

import type { BuilderAccessError } from '../../domain/ports/builder-access.port';
import type { ListPagesDependencies } from '../builder-dependencies';
import type { MapAwaitingView, MapPageUseView, MapUsageView } from '../contracts/map-usage-views';

/**
 * Which saved pages place which saved map, and which map components still wait for one, for the
 * maps screen: it tells a map that is ready from one a page already shows, links each component,
 * points a new map at the block waiting for it, and says why a map cannot be deleted before anyone
 * tries. The release
 * module still guards the deletion itself, against drafts and the live release.
 */
export class ListMapUsage {
  constructor(private readonly deps: ListPagesDependencies) {}

  execute(
    websiteId: string,
  ): AppResultAsync<MapUsageView, BuilderAccessError | InfrastructureAppError> {
    return this.deps.access
      .authorizeWebsite('page.read', websiteId)
      .andThen((scope) =>
        parseWebsiteId(websiteId).asyncAndThen((id) =>
          readWebsitePages(this.deps.pages, { websiteId: id, tenantId: scope.tenantId }),
        ),
      )
      .map(({ pages, isTruncated }) => {
        const byMap: Record<string, MapPageUseView[]> = {};
        const awaiting: MapAwaitingView[] = [];
        for (const page of pages) {
          if (page.config === null) {
            continue;
          }
          const components = new Map<string, Array<{ nodeId: string; type: string }>>();
          for (const { mapId, nodeId, type } of savedMapUsesOf(page.config, this.deps.components)) {
            const list = components.get(mapId) ?? [];
            list.push({ nodeId, type });
            components.set(mapId, list);
          }
          components.forEach((list, mapId) => {
            (byMap[mapId] ??= []).push({ pageId: page.id, title: page.title, components: list });
          });
          for (const { nodeId, type } of mapsAwaitingChoiceOf(page.config, this.deps.components)) {
            awaiting.push({ pageId: page.id, title: page.title, nodeId, type });
          }
        }
        return { byMap, awaiting, isTruncated };
      });
  }
}
