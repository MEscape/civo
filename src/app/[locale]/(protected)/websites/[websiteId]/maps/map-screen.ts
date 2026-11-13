import { getBuilderQueries } from '@modules/builder';
import { builderRoutes } from '@modules/builder/client';
import { loadComponentLabels } from '@modules/component-platform';
import { getReleaseQueries } from '@modules/release';
import { RELEASE_ERROR_CODES, deleteUnusedMapAction, releaseRoutes } from '@modules/release/client';

import type { getWebsiteAccess } from '@/app/_lib/website-access';

type WebsiteAccess = Awaited<ReturnType<typeof getWebsiteAccess>>;

/**
 * What the map screens take from their neighbours, in one place so the list and a map's own page
 * cannot drift apart: which components place each map (read from the builder and the live
 * release), the way into the builder, and the deletion that first checks no page places the map.
 * The map module cannot import those modules without a cycle, so the route hands them in.
 */
export function mapScreen(access: WebsiteAccess, websiteId: string) {
  return {
    builderHref: builderRoutes.pages(websiteId),
    deleteMap: { action: deleteUnusedMapAction, inUseCode: RELEASE_ERROR_CODES.mapInUse },
    canPublish: access.may('release.publish'),
    usage:
      access.may('page.read') && access.may('release.read')
        ? {
            drafts: (id: string) => getBuilderQueries().listMapUsage.execute(id),
            live: (id: string) => getReleaseQueries().listLiveMapUsage.execute(id),
            labels: loadComponentLabels,
            editorHref: builderRoutes.editor,
            componentHref: builderRoutes.component,
            releasesHref: releaseRoutes.releases,
          }
        : null,
  };
}
