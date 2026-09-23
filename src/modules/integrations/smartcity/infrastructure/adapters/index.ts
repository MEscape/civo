import { MockSmartCityDataProvider } from "./mock-smartcity-provider";
import { RestSmartCityDataProvider } from "./rest-smartcity-provider";
import type { SmartCityDataProvider } from "./smartcity-data-provider";
import { resolveDataset } from "@/modules/data-sources/infrastructure/data-source-resolver";
import { dataSourceRepository } from "@/modules/data-sources/infrastructure/data-source-repository";

export type { SmartCityDataProvider };

/**
 * The mock provider is stateless — one instance is reused across all
 * unbound/fallback calls.
 */
let mockInstance: SmartCityDataProvider | null = null;
function mockProvider(): SmartCityDataProvider {
    if (!mockInstance) mockInstance = new MockSmartCityDataProvider();
    return mockInstance;
}

/**
 * Resolves the SmartCity data provider for a specific Dataset (Phase 3.5).
 * Exact mirror of getCivicDataProvider — same pattern, same resolver,
 * different component family.
 *
 * Resolution:
 * - `datasetId` undefined or unknown → mock provider
 * - Dataset found, source is MOCK → mock provider
 * - Dataset found, source is REST + mapping → REST provider
 * - Dataset found, source is REST, no mapping → mock provider
 */
export async function getSmartCityDataProvider(datasetId?: string): Promise<SmartCityDataProvider> {
    const resolved = await resolveDataset(datasetId);

    if (!resolved) return mockProvider();

    const { dataset, sourceId, sourceKind } = resolved;

    if (sourceKind === "REST" && dataset.mapping) {
        const sourceResult = await dataSourceRepository.findById(sourceId);
        if (sourceResult.ok && sourceResult.data) {
            return new RestSmartCityDataProvider(sourceResult.data, dataset);
        }
    }

    return mockProvider();
}
