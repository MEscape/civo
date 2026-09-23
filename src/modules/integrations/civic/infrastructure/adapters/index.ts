import { MockCivicDataProvider } from "./mock-civic-provider";
import { RestCivicDataProvider } from "./rest-civic-provider";
import type { CivicDataProvider } from "./civic-data-provider";
import { resolveDataset } from "@/modules/data-sources/infrastructure/data-source-resolver";
import { dataSourceRepository } from "@/modules/data-sources/infrastructure/data-source-repository";

export type { CivicDataProvider };

/**
 * The mock provider instance is stateless — one instance is reused across
 * all unbound/fallback calls rather than constructing a new one per request.
 */
let mockInstance: CivicDataProvider | null = null;
function mockProvider(): CivicDataProvider {
    if (!mockInstance) mockInstance = new MockCivicDataProvider();
    return mockInstance;
}

/**
 * Resolves the civic data provider for a specific Dataset (Phase 3.5).
 *
 * This is the ONLY import point any civic component should use — components
 * receive a canonical, source-agnostic `CivicDataProvider` and never touch
 * Prisma, external APIs, or `DataSource`/`Dataset` configuration directly.
 *
 * Resolution logic:
 * - `datasetId` undefined or unknown → mock provider (sample data)
 * - Dataset found, source is MOCK → mock provider (sample data)
 * - Dataset found, source is REST, dataset has a mapping → REST provider
 * - Dataset found, source is REST, no mapping yet → mock provider
 *
 * `RestCivicDataProvider` is constructed fresh per call since it closes
 * over a specific Dataset row. The row is already loaded by resolveDataset,
 * so there is no additional fetch to memoize.
 */
export async function getCivicDataProvider(datasetId?: string): Promise<CivicDataProvider> {
    const resolved = await resolveDataset(datasetId);

    if (!resolved) return mockProvider();

    const { dataset, sourceId, sourceKind } = resolved;

    if (sourceKind === "REST" && dataset.mapping) {
        const sourceResult = await dataSourceRepository.findById(sourceId);
        if (sourceResult.ok && sourceResult.data) {
            return new RestCivicDataProvider(sourceResult.data, dataset);
        }
    }

    return mockProvider();
}
