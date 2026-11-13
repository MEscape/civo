import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { parseWebsiteId } from '../../domain/models/ids';
import { mediaUsesOf } from '../../domain/models/page-media-usage';
import { readWebsitePages } from '../services/read-website-pages';

import type { BuilderAccessError } from '../../domain/ports/builder-access.port';
import type { ListPagesDependencies } from '../builder-dependencies';
import type { MediaPageUseView, MediaUsageView } from '../contracts/media-usage-views';

/**
 * Which saved pages show which uploaded file, for the media screen: it says where a file is used
 * before anyone tries to delete it, with a way to each component. The media module still guards
 * the deletion itself, against drafts and every release.
 */
export class ListMediaUsage {
  constructor(private readonly deps: ListPagesDependencies) {}

  execute(
    websiteId: string,
  ): AppResultAsync<MediaUsageView, BuilderAccessError | InfrastructureAppError> {
    return this.deps.access
      .authorizeWebsite('page.read', websiteId)
      .andThen((scope) =>
        parseWebsiteId(websiteId).asyncAndThen((id) =>
          readWebsitePages(this.deps.pages, { websiteId: id, tenantId: scope.tenantId }),
        ),
      )
      .map(({ pages, isTruncated }) => {
        const byAsset: Record<string, MediaPageUseView[]> = {};
        for (const page of pages) {
          const onPage = new Map<string, Array<{ nodeId: string; type: string }>>();
          for (const use of page.config === null
            ? []
            : mediaUsesOf(page.config, this.deps.components)) {
            const components = onPage.get(use.assetId) ?? [];
            components.push({ nodeId: use.nodeId, type: use.type });
            onPage.set(use.assetId, components);
          }
          for (const [assetId, components] of onPage) {
            (byAsset[assetId] ??= []).push({ pageId: page.id, title: page.title, components });
          }
        }
        return { byAsset, isTruncated };
      });
  }
}
