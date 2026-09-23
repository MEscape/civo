import { stableStringify } from "@/lib/utils/stable-stringify";

/**
 * Derives a version string for the parts of a dataset and its parent source
 * that determine WHAT is fetched and HOW it is interpreted: the source's
 * `kind` and `config` (URL, path, auth mode) and the dataset's own field `mapping`.
 *
 * Deliberately excludes status, lastFetchedAt, and updatedAt so that test
 * connections and status bookkeeping don't invalidate the cache.
 *
 * Object keys are sorted before serializing, so two structurally equal
 * blobs always produce the same version regardless of key-insertion order.
 */
export function datasetCacheVersion(params: {
    sourceKind: string;
    sourceConfig: unknown;
    datasetMapping: unknown;
}): string {
    return stableStringify({
        kind: params.sourceKind,
        config: params.sourceConfig,
        mapping: params.datasetMapping,
    });
}
