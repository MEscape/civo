import { websiteRoutes } from '@modules/website/client';

import { buildQueryString, joinPath } from '@lib/utils';

interface HistoryPosition {
  readonly page: number;
  readonly pageSize?: number;
}

interface PreviewOptions {
  /** The page of the release list the preview came from, so the way back lands there. */
  readonly from?: HistoryPosition;
  /** The page of the release to show; empty for the home page, left out for the first one. */
  readonly path?: string;
}

const releasesPath = (websiteId: string) => `${websiteRoutes.detail(websiteId)}/releases`;

/**
 * The paths the release actions revalidate that this module owns. Routes
 * owned by the website and builder modules are NOT mirrored here: actions
 * take them from those modules' own route tables, so moving a route there
 * never needs a second edit in this module.
 */
export const releaseRoutes = {
  /** Releases and component updates are two parts of one sub-page of the website. */
  releases: releasesPath,
  /** One release's pages as they were published. */
  preview: (
    websiteId: string,
    releaseId: string,
    { from = { page: 1 }, path }: PreviewOptions = {},
  ) =>
    `${releasesPath(websiteId)}/${releaseId}/preview${buildQueryString({
      from: from.page > 1 ? from.page : undefined,
      fromPageSize: from.pageSize,
      path,
    })}`,
  /** The release list at the same page and size, so the way back lands where the person left. */
  releasesAt: (websiteId: string, from: HistoryPosition) =>
    `${releasesPath(websiteId)}${buildQueryString({
      page: from.page > 1 ? from.page : undefined,
      pageSize: from.pageSize,
    })}`,
  /** The component updates tab, at a page and size of its history. */
  updates: (websiteId: string, from: HistoryPosition = { page: 1 }) =>
    `${releasesPath(websiteId)}${buildQueryString({
      tab: 'updates',
      page: from.page > 1 ? from.page : undefined,
      pageSize: from.pageSize,
    })}`,
  /** A published site, keyed by its (globally unique) slug; `pagePath` is a page's stored path, empty for the home page. */
  publicSite: (siteSlug: string, pagePath = '') => joinPath('s', siteSlug, pagePath),
} as const;
