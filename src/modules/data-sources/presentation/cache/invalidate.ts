import { revalidatePath, revalidateTag } from 'next/cache';

import { dataSourceCacheTag, datasetCacheTag } from '../../application/contracts/cache-tags';
import { dataSourceRoutes } from '../routes';

/**
 * The ONE place cache invalidation is expressed (caching.md: "mutations
 * must invalidate all affected cache entries", precisely, at the delivery
 * boundary). Actions call these after a successful mutation.
 *
 * `revalidateTag(tag)` is the single-argument form. On Next.js 16 it takes
 * a cache-life profile as its second argument (or use `updateTag` inside a
 * Server Action for read-your-writes); adjust here and nowhere else.
 */
export function invalidateSettings(websiteId: string): void {
  revalidatePath(dataSourceRoutes.settings(websiteId));
}

/** A dataset change also changes what builder components resolve. */
export function invalidateDatasetConsumers(websiteId: string, datasetId: string): void {
  revalidateTag(datasetCacheTag(datasetId), 'default');
  revalidatePath(dataSourceRoutes.settings(websiteId));
  revalidatePath(dataSourceRoutes.builder(websiteId));
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
  revalidatePath(dataSourceRoutes.settings(websiteId));
  revalidatePath(dataSourceRoutes.builder(websiteId));
}
