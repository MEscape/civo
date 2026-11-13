import { getBuilderQueries } from '@modules/builder';
import { builderRoutes } from '@modules/builder/client';
import { loadComponentLabels } from '@modules/component-platform';

import type { getWebsiteAccess } from '@/app/_lib/website-access';

type WebsiteAccess = Awaited<ReturnType<typeof getWebsiteAccess>>;

/**
 * What the media screen takes from its neighbours: what the person may do, and which components
 * show each file (read from the builder, with a way into the editor), so a delete can say where a
 * file is still used before it is tried. The builder imports the media picker, so media cannot
 * import the builder without a cycle; the route hands it in.
 */
export function mediaScreen(access: WebsiteAccess) {
  return {
    mayUpload: access.may('media.upload'),
    mayDelete: access.may('media.delete'),
    usage:
      access.may('media.delete') && access.may('page.read')
        ? {
            drafts: (websiteId: string) => getBuilderQueries().listMediaUsage.execute(websiteId),
            labels: loadComponentLabels,
            componentHref: builderRoutes.component,
          }
        : null,
  };
}
