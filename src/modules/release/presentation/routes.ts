import { websiteRoutes } from '@modules/website/client';

import { joinPath } from '@lib/utils';

/**
 * The paths the release actions revalidate that this module owns. Routes
 * owned by the website and builder modules are NOT mirrored here: actions
 * take them from those modules' own route tables, so moving a route there
 * never needs a second edit in this module.
 */
export const releaseRoutes = {
  /** The migrations panel is a sub-page of the website's own page. */
  migrations: (websiteId: string) => `${websiteRoutes.detail(websiteId)}/migrations`,
  /** A published site, keyed by its (globally unique) slug; `pagePath` is a page's stored path, empty for the home page. */
  publicSite: (siteSlug: string, pagePath = '') => joinPath('s', siteSlug, pagePath),
} as const;
