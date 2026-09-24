import { RestCivicDataProvider } from "./rest-civic-provider";
import type { CivicDataProvider } from "./civic-data-provider";
import { resolveDataset } from "@/modules/data-sources/infrastructure/data-source-resolver";
import { dataSourceRepository } from "@/modules/data-sources/infrastructure/data-source-repository";
import { ok, err } from "@/lib/result/result";
import { AppErrors } from "@/lib/errors/app-error";
import { applyMapping, datasetMappingSchema } from "@/modules/data-sources/domain/field-mapping-schema";
import { deriveMappedRecordId } from "@/modules/data-sources/infrastructure/derive-mapped-record-id";
import { 
    newsItemSchema, civicEventSchema, serviceSchema, contactSchema, 
    openingHoursEntrySchema, serviceDetailSchema, councilBodySchema, 
    wasteCollectionEntrySchema, alertSchema, departmentSchema 
} from "@/modules/content/domain/civic-schema";

export type { CivicDataProvider };

/**
 * A fallback provider that simply returns empty arrays when no
 * dataset is bound to a component.
 */
class EmptyCivicDataProvider implements CivicDataProvider {
    async getNews() { return ok([]); }
    async getNewsBySlug() { return err(AppErrors.notFound("Meldung")); }
    async getEvents() { return ok([]); }
    async getServices() { return ok([]); }
    async getContacts() { return ok([]); }
    async getOpeningHours() { return ok([]); }
    async getServiceDetails() { return ok([]); }
    async getCouncilBodies() { return ok([]); }
    async getWasteCollection() { return ok([]); }
    async getWasteCollectionEntries() { return ok([]); }
    async getAlerts() { return ok([]); }
    async getDepartments() { return ok([]); }
}

let emptyInstance: CivicDataProvider | null = null;
function emptyProvider(): CivicDataProvider {
    if (!emptyInstance) emptyInstance = new EmptyCivicDataProvider();
    return emptyInstance;
}

class PreviewCivicDataProvider implements CivicDataProvider {
    private async getMapped<T>(canonicalType: string, schema: any): Promise<T[]> {
        const { MOCK_DATASETS, getMockPayload } = await import("@/data/musterstadt");
        const ds = MOCK_DATASETS.find(d => d.canonicalType === canonicalType);
        if (!ds) return [];
        const payload = getMockPayload(ds.path);
        if (!payload || !Array.isArray(payload)) return [];
        const mappingParsed = datasetMappingSchema.safeParse(ds.mapping);
        if (!mappingParsed.success) return [];
        const items: T[] = [];
        for (const raw of payload) {
            const mapped = applyMapping(mappingParsed.data, raw);
            if (!mapped.ok) continue;
            const candidate = { id: deriveMappedRecordId(raw, mapped.data), ...mapped.data };
            const validated = schema.safeParse(candidate);
            if (validated.success) items.push(validated.data as T);
        }
        return items;
    }

    async getNews(options?: { limit?: number; category?: string }) {
        let items = await this.getMapped<any>("NewsItem", newsItemSchema);
        if (options?.category) items = items.filter(i => i.category === options.category);
        if (options?.limit) items = items.slice(0, options.limit);
        return ok(items);
    }
    async getNewsBySlug(slug: string) {
        const items = await this.getMapped<any>("NewsItem", newsItemSchema);
        const item = items.find(i => i.slug === slug);
        return item ? ok(item) : err(AppErrors.notFound("Meldung"));
    }
    async getEvents(options?: { limit?: number; category?: string }) {
        let items = await this.getMapped<any>("Event", civicEventSchema);
        if (options?.category) items = items.filter(i => i.category === options.category);
        if (options?.limit) items = items.slice(0, options.limit);
        return ok(items);
    }
    async getServices(options?: { limit?: number }) {
        let items = await this.getMapped<any>("Service", serviceSchema);
        if (options?.limit) items = items.slice(0, options.limit);
        return ok(items);
    }
    async getContacts(options?: { limit?: number }) {
        let items = await this.getMapped<any>("Contact", contactSchema);
        if (options?.limit) items = items.slice(0, options.limit);
        return ok(items);
    }
    async getOpeningHours() { return ok(await this.getMapped<any>("OpeningHoursEntry", openingHoursEntrySchema)); }
    async getServiceDetails() { return ok(await this.getMapped<any>("ServiceDetail", serviceDetailSchema)); }
    async getCouncilBodies() { return ok(await this.getMapped<any>("CouncilBody", councilBodySchema)); }
    async getWasteCollection() { return ok(await this.getMapped<any>("WasteCollectionEntry", wasteCollectionEntrySchema)); }
    async getWasteCollectionEntries() { return ok(await this.getMapped<any>("WasteCollectionEntry", wasteCollectionEntrySchema)); }
    async getAlerts() { return ok(await this.getMapped<any>("Alert", alertSchema)); }
    async getDepartments() { return ok(await this.getMapped<any>("Department", departmentSchema)); }
}

let previewInstance: CivicDataProvider | null = null;
function previewProvider(): CivicDataProvider {
    if (!previewInstance) previewInstance = new PreviewCivicDataProvider();
    return previewInstance;
}

/**
 * Resolves the civic data provider for a specific Dataset (Phase 3.5).
 *
 * This is the ONLY import point any civic component should use.
 *
 * Resolution logic:
 * - `datasetId` undefined or unknown AND editmode is true → Preview provider
 * - `datasetId` undefined or unknown AND editmode is false → Empty provider
 * - Dataset found, has a mapping → RestCivicDataProvider (runs mapping engine)
 */
export async function getCivicDataProvider(datasetId?: string, editmode: boolean = false): Promise<CivicDataProvider> {
    if (!datasetId) {
        return editmode ? previewProvider() : emptyProvider();
    }

    const resolved = await resolveDataset(datasetId);

    if (!resolved) return emptyProvider();

    const { dataset, sourceId } = resolved;

    if (dataset.mapping) {
        const sourceResult = await dataSourceRepository.findById(sourceId);
        if (sourceResult.ok && sourceResult.data) {
            return new RestCivicDataProvider(sourceResult.data, dataset);
        }
    }

    return emptyProvider();
}
