import { websiteRoutes } from '@modules/website/client';

import { joinPath } from '@lib/utils';

/**
 * The paths the release actions revalidate that this module owns. Routes
 * owned by the website and builder modules are NOT mirrored here: actions
 * take them from those modules' own route tables, so moving a route there
 * never needs a second edit in this module.
 */
export const releaseRoutes = {
  /** Releases and component updates are two parts of one sub-page of the website. */
  releases: (websiteId: string) => `${websiteRoutes.detail(websiteId)}/releases`,
  /** One release's pages as they were published; `path` picks the page, empty for the home page. */
  preview: (websiteId: string, releaseId: string, fromPage = 1) =>
    `${websiteRoutes.detail(websiteId)}/releases/${releaseId}/preview${fromPage > 1 ? `?from=${fromPage}` : ''}`,
  /** The release list at the page a person came from, so the way back lands where they left. */
  releasesAt: (websiteId: string, page: number) =>
    `${websiteRoutes.detail(websiteId)}/releases${page > 1 ? `?page=${page}` : ''}`,
  updates: (websiteId: string) => `${websiteRoutes.detail(websiteId)}/releases?tab=updates`,
  /** A published site, keyed by its (globally unique) slug; `pagePath` is a page's stored path, empty for the home page. */
  publicSite: (siteSlug: string, pagePath = '') => joinPath('s', siteSlug, pagePath),
} as const;
