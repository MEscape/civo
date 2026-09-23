import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { AppErrors } from "@/lib/errors/app-error";
import { datasetRepository } from "@/modules/data-sources/infrastructure/dataset-repository";
import { dataSourceRepository } from "@/modules/data-sources/infrastructure/data-source-repository";
import { restJsonAdapter } from "@/modules/data-sources/infrastructure/adapters/rest-json-adapter";
import type { DataSourceAdapter, DataSourceError, DataDiscoveryResult } from "@/modules/data-sources/domain/data-source-adapter";
import {
    createDatasetSchema,
    updateDatasetSchema,
    type DatasetView,
    type CanonicalType,
    type CreateDatasetInput,
    type UpdateDatasetInput,
} from "@/modules/data-sources/domain/dataset-schema";
import { applyMapping, datasetMappingSchema, type DatasetMapping, type MappingFieldError } from "@/modules/data-sources/domain/field-mapping-schema";
import { adapterForKind, connectionFailure } from "./adapter-helpers";
import type { DataSourceKind } from "@/modules/data-sources/domain/data-source-schema";

export type PreviewError =
    | { kind: "infrastructure"; error: DataSourceError }
    | { kind: "mapping"; errors: MappingFieldError[] };


export type { DatasetView, CanonicalType };


/**
 * Loads a dataset, confirms it belongs to websiteId (via parent DataSource),
 * and returns the full DatasetView. Returns a connection-failure error if not found.
 */
async function loadOwnedDataset(
    datasetId: string,
    websiteId: string
): Promise<Result<DatasetView, DataSourceError>> {
    const result = await datasetRepository.findByIdForWebsite(datasetId, websiteId);

    if (!result.ok) return err(connectionFailure(result.error, "CONNECTION_FAILED"));

    if (!result.data) return err(connectionFailure(AppErrors.notFound("Datensatz"), "CONNECTION_FAILED"));

    return ok(result.data);
}

/**
 * Application service for Dataset management.
 *
 * Datasets are the primary handle components use to resolve data. Each
 * Dataset belongs to a DataSource and exposes one canonical type (e.g.
 * "Event", "NewsItem") with its own field mapping.
 *
 * Every method that accepts a `datasetId` or `dataSourceId` also takes
 * `websiteId` to confirm ownership (never trust caller-supplied IDs to
 * already be scoped correctly).
 */
export const datasetService = {
    /**
     * Lists datasets compatible with a component's declared canonicalType,
     * scoped to a website. Powers the dataset selector in the properties panel.
     */
    async listCompatible(websiteId: string, canonicalType: CanonicalType): Promise<Result<DatasetView[], AppError>> {
        return datasetRepository.findCompatible(websiteId, canonicalType);
    },

    async listForDataSource(dataSourceId: string, websiteId: string): Promise<Result<DatasetView[], AppError>> {
        // Verify ownership of the DataSource first.
        const owned = await dataSourceRepository.findByIdForWebsite(dataSourceId, websiteId);
        if (!owned.ok) return owned;
        if (!owned.data) return err(AppErrors.notFound("Datenquelle"));
        return datasetRepository.findByDataSource(dataSourceId);
    },

    /**
     * Creates a new Dataset inside an existing DataSource.
     * Validates that the DataSource belongs to the caller's website.
     */
    async create(input: unknown, websiteId: string): Promise<Result<DatasetView, AppError>> {
        const parsed = createDatasetSchema.safeParse(input);

        if (!parsed.success) {
            return err(AppErrors.validation(parsed.error.issues[0]?.message ?? "Ungültige Eingabe für den Datensatz."));
        }

        // Confirm ownership of the parent DataSource.
        const owned = await dataSourceRepository.findByIdForWebsite(parsed.data.dataSourceId, websiteId);
        if (!owned.ok) return owned;
        if (!owned.data) return err(AppErrors.notFound("Datenquelle"));

        return datasetRepository.create(parsed.data);
    },

    /**
     * Updates a Dataset's name or slug.
     */
    async update(datasetId: string, input: unknown, websiteId: string): Promise<Result<DatasetView, AppError>> {
        const parsed = updateDatasetSchema.safeParse(input);

        if (!parsed.success) {
            return err(AppErrors.validation(parsed.error.issues[0]?.message ?? "Ungültige Eingabe."));
        }

        const owned = await datasetRepository.findByIdForWebsite(datasetId, websiteId);
        if (!owned.ok) return owned;
        if (!owned.data) return err(AppErrors.notFound("Datensatz"));

        return datasetRepository.update(datasetId, parsed.data);
    },

    async delete(datasetId: string, websiteId: string): Promise<Result<void, AppError>> {
        const owned = await datasetRepository.findByIdForWebsite(datasetId, websiteId);
        if (!owned.ok) return owned;
        if (!owned.data) return err(AppErrors.notFound("Datensatz"));
        return datasetRepository.delete(datasetId);
    },

    /**
     * Runs discovery against the Dataset's parent DataSource to retrieve
     * a sample of external records and available fields. Used by the
     * mapping UI to show which source paths are available.
     */
    async discover(datasetId: string, websiteId: string): Promise<Result<DataDiscoveryResult, DataSourceError>> {
        const ownedResult = await loadOwnedDataset(datasetId, websiteId);
        if (!ownedResult.ok) return ownedResult;

        const dataset = ownedResult.data;

        // Load the full DataSource for its config.
        const sourceResult = await dataSourceRepository.findById(dataset.dataSourceId);
        if (!sourceResult.ok) return err(connectionFailure(sourceResult.error, "CONNECTION_FAILED"));
        if (!sourceResult.data) return err(connectionFailure(AppErrors.notFound("Datenquelle"), "CONNECTION_FAILED"));

        const source = sourceResult.data;
        const adapter = adapterForKind(source.kind as DataSourceKind);

        if (!adapter) {
            return err(
                connectionFailure(
                    AppErrors.validation(`Für Datenquellen des Typs "${source.kind}" ist noch kein Connector verfügbar.`),
                    "INVALID_CONFIGURATION"
                )
            );
        }

        const configParsed = adapter.parseConfig(source.config);
        if (!configParsed.ok) {
            return err(
                connectionFailure(
                    AppErrors.validation("Die gespeicherte Konfiguration dieser Datenquelle ist nicht mehr gültig."),
                    "INVALID_CONFIGURATION"
                )
            );
        }

        return adapter.discover(configParsed.data, { dataSourceId: source.id });
    },

    /**
     * Applies a candidate mapping to one live sample record from the source,
     * without saving — used by the mapping UI's live preview.
     */
    async previewMapping(
        datasetId: string,
        websiteId: string,
        mapping: DatasetMapping
    ): Promise<Result<Record<string, unknown>, PreviewError>> {
        const discoveryResult = await this.discover(datasetId, websiteId);

        if (!discoveryResult.ok) return err({ kind: "infrastructure", error: discoveryResult.error });

        const [record] = discoveryResult.data.sample;

        if (record === undefined) {
            return err({
                kind: "infrastructure",
                error: connectionFailure(
                    AppErrors.validation("Die Datenquelle hat keine Beispieldatensätze für die Vorschau zurückgegeben."),
                    "INVALID_RESPONSE"
                )
            });
        }

        const applyResult = applyMapping(mapping, record);
        if (!applyResult.ok) {
            return err({ kind: "mapping", errors: applyResult.error });
        }
        return ok(applyResult.data);
    },

    /**
     * Validates and saves a field mapping for a Dataset. Fetches a live sample
     * first and dry-runs the mapping to give fast feedback.
     */
    async saveMapping(datasetId: string, mapping: unknown, websiteId: string): Promise<Result<DatasetView, AppError>> {
        // Validate the mapping schema first.
        const parsed = datasetMappingSchema.safeParse(mapping);

        if (!parsed.success) {
            return err(AppErrors.validation(parsed.error.issues[0]?.message ?? "Ungültige Mapping-Eingabe."));
        }

        const previewResult = await this.previewMapping(datasetId, websiteId, parsed.data);

        if (!previewResult.ok) {
            if (previewResult.error.kind === "infrastructure") {
                return err(previewResult.error.error);
            }
            return err(
                AppErrors.validation(
                    `Das Mapping konnte auf einen Live-Datensatz nicht angewandt werden: ${
                        previewResult.error.errors[0]?.message ?? "unbekannter Fehler"
                    }`
                )
            );
        }

        return datasetRepository.saveMapping(datasetId, parsed.data);
    },
};
