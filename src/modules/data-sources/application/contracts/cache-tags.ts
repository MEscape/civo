/**
 * Cache tags are part of the module's contract: infrastructure attaches
 * them, mutations invalidate them, and consumers that cache anything
 * derived from a dataset can attach the same tag and be invalidated too.
 *
 *  - `data-source:<id>`  the raw external response of one source.
 *  - `dataset:<id>`      anything derived from one dataset's mapped records.
 */
export function dataSourceCacheTag(dataSourceId: string): string {
  return `data-source:${dataSourceId}`;
}

export function datasetCacheTag(datasetId: string): string {
  return `dataset:${datasetId}`;
}
