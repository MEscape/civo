import 'server-only';

import { revalidateTag } from 'next/cache';

import { revalidateLocalizedPath } from '@i18n/server';

import { dataSourceCacheTag, datasetCacheTag } from '../../application/contracts/cache-tags';
import { dataSourceRoutes } from '../routes';

/**
 * The ONE place cache invalidation is expressed (caching.md: "mutations
 * must invalidate all affected cache entries", precisely, at the delivery
 * boundary). Actions call these after a successful mutation. Addresses are
 * locale-prefixed, so they are revalidated per translation; `layout` covers
 * every screen below the list (a source, its forms, its mapping).
 */
export function invalidateSettings(websiteId: string): void {
  revalidateLocalizedPath(dataSourceRoutes.sources(websiteId), 'layout');
}

/** A dataset change also changes what builder components resolve. */
export function invalidateDatasetConsumers(websiteId: string, datasetId: string): void {
  revalidateTag(datasetCacheTag(datasetId), 'default');
  revalidateLocalizedPath(dataSourceRoutes.sources(websiteId), 'layout');
  revalidateLocalizedPath(dataSourceRoutes.builder(websiteId), 'layout');
}

/** A changed connection drops the source's raw-response cache and what components read from it. */
export function invalidateSourceConsumers(websiteId: string, dataSourceId: string): void {
  revalidateTag(dataSourceCacheTag(dataSourceId), 'default');
  revalidateLocalizedPath(dataSourceRoutes.sources(websiteId), 'layout');
  revalidateLocalizedPath(dataSourceRoutes.builder(websiteId), 'layout');
}

/** Removing a source drops its raw-response cache and everything derived from its datasets. */
export function invalidateRemovedDataSource(
  websiteId: string,
  dataSourceId: string,
  datasetIds: readonly string[],
): void {
  revalidateTag(dataSourceCacheTag(dataSourceId), 'default');
  datasetIds.forEach((datasetId) => {
    revalidateTag(datasetCacheTag(datasetId), 'default');
  });
  revalidateLocalizedPath(dataSourceRoutes.sources(websiteId), 'layout');
  revalidateLocalizedPath(dataSourceRoutes.builder(websiteId), 'layout');
}
