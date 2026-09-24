import { RestSmartCityDataProvider } from "./rest-smartcity-provider";
import type { SmartCityDataProvider } from "./smartcity-data-provider";
import { resolveDataset } from "@/modules/data-sources/infrastructure/data-source-resolver";
import { dataSourceRepository } from "@/modules/data-sources/infrastructure/data-source-repository";
import { ok } from "@/lib/result/result";
import { PreviewSmartCityDataProvider } from "./preview-smartcity-provider";

export type { SmartCityDataProvider };

/**
 * A fallback provider that simply returns empty arrays when no
 * dataset is bound to a component.
 */
class EmptySmartCityDataProvider implements SmartCityDataProvider {
    async getMetrics() { return ok([]); }
}

let emptyInstance: SmartCityDataProvider | null = null;
function emptyProvider(): SmartCityDataProvider {
    if (!emptyInstance) emptyInstance = new EmptySmartCityDataProvider();
    return emptyInstance;
}



let previewInstance: SmartCityDataProvider | null = null;
function previewProvider(): SmartCityDataProvider {
    if (!previewInstance) previewInstance = new PreviewSmartCityDataProvider();
    return previewInstance;
}

/**
 * Resolves the SmartCity data provider for a specific Dataset (Phase 3.5).
 */
export async function getSmartCityDataProvider(datasetId?: string, editmode: boolean = false): Promise<SmartCityDataProvider> {
    if (!datasetId) {
        return editmode ? previewProvider() : emptyProvider();
    }

    const resolved = await resolveDataset(datasetId);

    if (!resolved) return emptyProvider();

    const { dataset, sourceId } = resolved;

    if (dataset.mapping) {
        const sourceResult = await dataSourceRepository.findById(sourceId);
        if (sourceResult.ok && sourceResult.data) {
            return new RestSmartCityDataProvider(sourceResult.data, dataset);
        }
    }

    return emptyProvider();
}
