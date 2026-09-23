import { datasetRepository } from "@/modules/data-sources/infrastructure/dataset-repository";
import { logger } from "@/lib/logger/logger";
import type { DatasetView } from "@/modules/data-sources/domain/dataset-schema";
import type { DataSourceView, DataSourceKind } from "@/modules/data-sources/domain/data-source-schema";

/**
 * Resolves a Dataset by ID, returning the dataset and its parent DataSource.
 *
 * This is the ONLY place that translates a component's `datasetId` prop into
 * an actual provider configuration. The provider factories in each integration
 * module (civic/adapters/index.ts, smartcity/adapters/index.ts) call this and
 * use the returned `{ dataset, source }` pair to construct the right provider.
 *
 * Returns `null` when:
 * - `datasetId` is undefined/null (component has no dataset bound)
 * - the dataset row does not exist in the database
 *
 * In both cases the caller falls back to the mock provider — this is the
 * "degrade gracefully" contract: a missing or unresolvable datasetId always
 * yields sample data, never a broken component.
 */
export async function resolveDataset(datasetId: string | undefined): Promise<{
    dataset: DatasetView;
    sourceId: string;
    sourceKind: DataSourceKind;
} | null> {
    if (!datasetId) return null;

    const result = await datasetRepository.findById(datasetId);

    if (!result.ok) {
        logger.error("resolveDataset: failed to load dataset, falling back to mock", {
            datasetId,
            cause: result.error,
        });
        return null;
    }

    const dataset = result.data;
    if (!dataset) return null;

    return {
        dataset,
        sourceId: dataset.dataSourceId,
        sourceKind: dataset.sourceKind as DataSourceKind,
    };
}
