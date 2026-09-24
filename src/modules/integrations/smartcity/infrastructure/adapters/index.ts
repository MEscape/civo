import { RestSmartCityDataProvider } from "./rest-smartcity-provider";
import type { SmartCityDataProvider } from "./smartcity-data-provider";
import { resolveDataset } from "@/modules/data-sources/infrastructure/data-source-resolver";
import { dataSourceRepository } from "@/modules/data-sources/infrastructure/data-source-repository";
import { ok } from "@/lib/result/result";
import { applyMapping, datasetMappingSchema } from "@/modules/data-sources/domain/field-mapping-schema";
import { deriveMappedRecordId } from "@/modules/data-sources/infrastructure/derive-mapped-record-id";
import { smartCityMetricSchema } from "@/modules/content/domain/smartcity-schema";

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

class PreviewSmartCityDataProvider implements SmartCityDataProvider {
    async getMetrics(options?: { limit?: number; category?: string; includeSeries?: boolean; includeBreakdown?: boolean }) {
        const { MOCK_DATASETS, getMockPayload } = await import("@/data/musterstadt");
        const ds = MOCK_DATASETS.find(d => d.canonicalType === "SmartCityMetric");
        if (!ds) return ok([]);
        const payload = getMockPayload(ds.path);
        if (!payload || !Array.isArray(payload)) return ok([]);
        const mappingParsed = datasetMappingSchema.safeParse(ds.mapping);
        if (!mappingParsed.success) return ok([]);
        
        let items: any[] = [];
        for (const raw of payload) {
            const mapped = applyMapping(mappingParsed.data, raw);
            if (!mapped.ok) continue;
            const candidate = { id: deriveMappedRecordId(raw, mapped.data), ...mapped.data };
            const validated = smartCityMetricSchema.safeParse(candidate);
            if (validated.success) items.push(validated.data);
        }
        
        if (options?.category) items = items.filter(i => i.category === options.category);
        if (options?.limit) items = items.slice(0, options.limit);
        return ok(items);
    }
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
