import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { AppErrors } from "@/lib/errors/app-error";
import { dataSourceRepository } from "@/modules/data-sources/infrastructure/data-source-repository";
import { restJsonAdapter } from "@/modules/data-sources/infrastructure/adapters/rest-json-adapter";
import type { DataSourceAdapter, DataSourceError, DataDiscoveryResult } from "@/modules/data-sources/domain/data-source-adapter";
import { createDataSourceSchema, type DataSourceKind, type DataSourceView } from "@/modules/data-sources/domain/data-source-schema";
import { resolveRestUrl } from "@/modules/data-sources/domain/resolve-rest-url";
import { adapterForKind, connectionFailure } from "./adapter-helpers";

export type { DataSourceView };

/** A DataSourceView looked up and confirmed to belong to websiteId. */
async function loadOwnedRow(
    dataSourceId: string,
    websiteId: string
): Promise<Result<DataSourceView, DataSourceError>> {
    const rowResult = await dataSourceRepository.findByIdForWebsite(dataSourceId, websiteId);

    if (!rowResult.ok) return err(connectionFailure(rowResult.error, "CONNECTION_FAILED"));

    if (!rowResult.data) return err(connectionFailure(AppErrors.notFound("Datenquelle"), "CONNECTION_FAILED"));

    return ok(rowResult.data);
}

/** Resolves the adapter and parsed config for an owned row. */
function loadAdapterAndConfig(
    row: DataSourceView
): Result<{ adapter: DataSourceAdapter<unknown>; config: unknown }, DataSourceError> {
    const adapter = adapterForKind(row.kind);

    if (!adapter) {
        return err(
            connectionFailure(
                AppErrors.validation(`Für Datenquellen des Typs "${row.kind}" ist noch kein Connector verfügbar.`),
                "INVALID_CONFIGURATION"
            )
        );
    }

    const configParsed = adapter.parseConfig(row.config);

    if (!configParsed.ok) {
        return err(
            connectionFailure(
                AppErrors.validation("Die gespeicherte Konfiguration dieser Datenquelle ist nicht mehr gültig."),
                "INVALID_CONFIGURATION"
            )
        );
    }

    return ok({ adapter, config: configParsed.data });
}

async function testConnectionInternal(
    dataSourceId: string,
    websiteId: string
): Promise<Result<{ statusCode: number; responseTimeMs: number }, DataSourceError>> {
    const rowResult = await loadOwnedRow(dataSourceId, websiteId);

    if (!rowResult.ok) return rowResult;

    const row = rowResult.data;
    const resolved = loadAdapterAndConfig(row);

    if (!resolved.ok) return resolved;

    const testResult = await resolved.data.adapter.testConnection(resolved.data.config, { dataSourceId: row.id });

    await dataSourceRepository.recordTestResult(row.id, {
        status: testResult.ok ? "OK" : "ERROR",
        lastError: testResult.ok ? null : testResult.error.message,
    });

    return testResult;
}

async function discoverInternal(
    dataSourceId: string,
    websiteId: string
): Promise<Result<DataDiscoveryResult, DataSourceError>> {
    const rowResult = await loadOwnedRow(dataSourceId, websiteId);

    if (!rowResult.ok) return rowResult;

    const resolved = loadAdapterAndConfig(rowResult.data);

    if (!resolved.ok) return resolved;

    return resolved.data.adapter.discover(resolved.data.config, { dataSourceId: rowResult.data.id });
}

/**
 * Application service for Data Source management.
 *
 * A DataSource is a connection to an external system. It has no dataset-kind
 * constraint — a website may have any number of sources. Datasets (with their
 * field mappings) are managed via dataset-service.ts.
 */
export const dataSourceService = {
    async listForWebsite(websiteId: string): Promise<Result<DataSourceView[], AppError>> {
        return dataSourceRepository.findByWebsite(websiteId);
    },

    async listForWebsiteWithDatasets(websiteId: string): Promise<Result<DataSourceView[], AppError>> {
        return dataSourceRepository.findByWebsiteWithDatasets(websiteId);
    },

    /**
     * Creates a new DataSource for a website. Validates config against the
     * kind's schema and applies the SSRF guard for REST sources.
     */
    async create(input: unknown): Promise<Result<DataSourceView, AppError>> {
        const parsed = createDataSourceSchema.safeParse(input);

        if (!parsed.success) {
            return err(AppErrors.validation(parsed.error.issues[0]?.message ?? "Ungültige Eingabe für die Datenquelle."));
        }

        const adapter = adapterForKind(parsed.data.kind);
        const configResult = adapter ? adapter.parseConfig(parsed.data.config) : ok(parsed.data.config);

        if (!configResult.ok) {
            return err(AppErrors.validation(configResult.error, "config"));
        }

        if (parsed.data.kind === "REST") {
            const restConfig = configResult.data as { baseUrl: string; path: string };
            const urlCheck = resolveRestUrl(restConfig);

            if (!urlCheck.ok) {
                return err(AppErrors.validation(urlCheck.error, "config.baseUrl"));
            }
        }

        return dataSourceRepository.create({
            websiteId: parsed.data.websiteId,
            name: parsed.data.name,
            kind: parsed.data.kind,
            config: configResult.data as Record<string, unknown>,
        });
    },

    async delete(dataSourceId: string, websiteId: string): Promise<Result<void, AppError>> {
        const owned = await dataSourceRepository.findByIdForWebsite(dataSourceId, websiteId);

        if (!owned.ok) return owned;

        if (!owned.data) return err(AppErrors.notFound("Datenquelle"));

        return dataSourceRepository.delete(dataSourceId);
    },

    async testConnection(
        dataSourceId: string,
        websiteId: string
    ): Promise<Result<{ statusCode: number; responseTimeMs: number }, DataSourceError>> {
        return testConnectionInternal(dataSourceId, websiteId);
    },

    async discover(dataSourceId: string, websiteId: string): Promise<Result<DataDiscoveryResult, DataSourceError>> {
        return discoverInternal(dataSourceId, websiteId);
    },
};
