import { RestCivicDataProvider } from "./rest-civic-provider";
import type { CivicDataProvider } from "./civic-data-provider";
import { resolveDataset } from "@/modules/data-sources/infrastructure/data-source-resolver";
import { dataSourceRepository } from "@/modules/data-sources/infrastructure/data-source-repository";
import { ok, err } from "@/lib/result/result";
import { AppErrors } from "@/lib/errors/app-error";
import { PreviewCivicDataProvider } from "./preview-civic-provider";

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
