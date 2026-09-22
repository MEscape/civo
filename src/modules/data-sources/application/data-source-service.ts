import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { AppErrors } from "@/lib/errors/app-error";
import {
    dataSourceRepository,
} from "@/modules/data-sources/infrastructure/data-source-repository";
import { restJsonAdapter } from "@/modules/data-sources/infrastructure/adapters/rest-json-adapter";
import type { DataSourceAdapter, DataSourceError, DataDiscoveryResult } from "@/modules/data-sources/domain/data-source-adapter";
import { createDataSourceSchema, saveMappingSchema, type DataSourceKind, type DataSourceView } from "@/modules/data-sources/domain/data-source-schema";
import { applyMapping, type DatasetMapping, type MappingFieldError } from "@/modules/data-sources/domain/field-mapping-schema";
import { resolveRestUrl } from "@/modules/data-sources/domain/resolve-rest-url";

export type { DataSourceView };

/**
 * Resolves which adapter implementation handles a given data source kind
 * (spec §27). MOCK and GRAPHQL have no adapter — MOCK is served directly
 * by the mock civic/smart-city providers, and GRAPHQL has no
 * implementation yet (spec §4 scopes this phase to REST/JSON only).
 *
 * Each adapter owns its own config schema (`adapter.parseConfig`), so
 * adding a second kind with an adapter does not require touching the
 * validation logic below — only this lookup.
 */
function adapterForKind(kind: DataSourceKind): DataSourceAdapter<unknown> | null {
    return kind === "REST" ? restJsonAdapter : null;
}

function connectionFailure(error: AppError, category: DataSourceError["category"]): DataSourceError {
    return { ...error, category };
}

/** A `DataSourceView` looked up and confirmed to belong to `websiteId`, or a diagnostic error to return as-is. */
async function loadOwnedRow(
    dataSourceId: string,
    websiteId: string
): Promise<Result<DataSourceView, DataSourceError>> {
    const rowResult = await dataSourceRepository.findByIdForWebsite(dataSourceId, websiteId);

    if (!rowResult.ok) return err(connectionFailure(rowResult.error, "CONNECTION_FAILED"));

    if (!rowResult.data) return err(connectionFailure(AppErrors.notFound("Datenquelle"), "CONNECTION_FAILED"));

    return ok(rowResult.data);
}

/** Resolves the adapter and parsed config for an owned row, or a diagnostic error. */
function loadAdapterAndConfig(
    row: DataSourceView
): Result<{ adapter: DataSourceAdapter<unknown>; config: unknown }, DataSourceError> {
    const adapter = adapterForKind(row.kind);

    if (!adapter) {
        return err(
            connectionFailure(
                AppErrors.validation(`No connector is available for data sources of kind "${row.kind}" yet.`),
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

/**
 * Runs "Test Connection" for a saved, owned data source (spec §6) and
 * records the outcome for the settings UI's status display (spec §3,
 * §29). Returns the adapter's category-tagged `DataSourceError` on
 * failure — deliberately not the generic `Result<T, AppError>` used
 * elsewhere — so the settings UI can show one of the four distinct
 * messages spec §6 asks for.
 *
 * A module-level function, not a method referencing `this`: `saveMapping`
 * below calls `discover`/`previewMapping` directly rather than through
 * `this.discover(...)`, so destructuring `dataSourceService`'s methods
 * cannot silently break them.
 */
async function testConnection(
    dataSourceId: string,
    websiteId: string
): Promise<Result<{ statusCode: number; responseTimeMs: number }, DataSourceError>> {
    const rowResult = await loadOwnedRow(dataSourceId, websiteId);

    if (!rowResult.ok) return rowResult;

    const row = rowResult.data;
    const resolved = loadAdapterAndConfig(row);

    if (!resolved.ok) return resolved;

    const testResult = await resolved.data.adapter.testConnection(resolved.data.config, { dataSourceId: row.id });

    // Persist the outcome regardless of success/failure so the settings
    // list's status badge and "last checked" timestamp stay current
    // (spec §3, §29). A failure to WRITE the diagnostic (e.g. a DB
    // hiccup) doesn't override the actual test outcome returned to the
    // caller — it's logged by the repository and otherwise ignored here.
    await dataSourceRepository.recordTestResult(row.id, {
        status: testResult.ok ? "OK" : "ERROR",
        lastError: testResult.ok ? null : testResult.error.message,
    });

    return testResult;
}

/**
 * Retrieves a sample of external data and flattens its available fields
 * for the mapping UI (spec §7). Read-only — never writes anything, since
 * discovery can be run speculatively while an administrator is exploring
 * a source.
 */
async function discover(
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
 * Applies a candidate mapping to one live sample record from the source,
 * without saving anything — used by both `saveMapping`'s validation step
 * and the mapping UI's live preview (spec §9).
 */
async function previewMapping(
    dataSourceId: string,
    websiteId: string,
    mapping: DatasetMapping
): Promise<Result<Result<Record<string, unknown>, MappingFieldError[]>, DataSourceError>> {
    const discoveryResult = await discover(dataSourceId, websiteId);

    if (!discoveryResult.ok) return discoveryResult;

    const [record] = discoveryResult.data.sample;

    if (record === undefined) {
        return err(
            connectionFailure(
                AppErrors.validation("Die Datenquelle hat keine Beispieldatensätze für die Vorschau zurückgegeben."),
                "INVALID_RESPONSE"
            )
        );
    }

    return ok(applyMapping(mapping, record));
}

/**
 * Application service for the Data Sources settings area (spec §3–§9).
 * Every method authorizes the caller against `websiteId` first, validates
 * input with Zod, and only then touches the repository or an adapter.
 * The Server Actions in `application/data-source-actions.ts` are thin
 * wrappers around this.
 *
 * Every method that accepts a `dataSourceId` also requires `websiteId`
 * and uses it to confirm the row is actually owned by that website
 * (`dataSourceRepository.findByIdForWebsite`) rather than trusting the
 * two to already correspond — a `dataSourceId` is caller-supplied input,
 * not something the server already knows the caller may act on (spec
 * §22, §29).
 */
export const dataSourceService = {
    async listForWebsite(websiteId: string): Promise<Result<DataSourceView[], AppError>> {
        return dataSourceRepository.findByWebsite(websiteId);
    },

    /**
     * Creates or replaces the one data source configured for a
     * (website, dataset) pair (spec §24 steps 2–4). Validates the
     * top-level shape first, then hands `config` to the target kind's
     * adapter to validate — a REST source can't be saved with
     * GraphQL-shaped config, and neither can be saved with a stray
     * credential in `config`, since each adapter's schema is `.strict()`.
     * For REST sources, also enforces the SSRF guard (spec §22) via
     * `resolveRestUrl`, so a private-network or metadata-endpoint URL is
     * rejected at save time with a clear message rather than only
     * failing later on first test or fetch. The adapter re-checks the
     * same guard at request time regardless (defense in depth, not a
     * replacement — a URL valid at save time is not guaranteed to stay
     * so, e.g. after a DNS record change).
     */
    async upsert(input: unknown): Promise<Result<DataSourceView, AppError>> {
        const parsed = createDataSourceSchema.safeParse(input);

        if (!parsed.success) {
            return err(AppErrors.validation(parsed.error.issues[0]?.message ?? "Ungültige Eingabe für die Datenquelle."));
        }

        const adapter = adapterForKind(parsed.data.kind);
        // MOCK has no adapter and no config to validate beyond the empty
        // shape createDataSourceSchema already checked; GRAPHQL/REST both
        // route through their adapter's own schema.
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

        return dataSourceRepository.upsert({
            websiteId: parsed.data.websiteId,
            dataset: parsed.data.dataset,
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
        return testConnection(dataSourceId, websiteId);
    },

    async discover(dataSourceId: string, websiteId: string): Promise<Result<DataDiscoveryResult, DataSourceError>> {
        return discover(dataSourceId, websiteId);
    },

    /**
     * Validates and saves a field mapping for a data source (spec §9,
     * §10). Before saving, this fetches a live sample and runs the
     * mapping against it end-to-end (map → nothing more — canonical Zod
     * validation of the *mapped* records happens per-dataset in each
     * provider, since only that provider knows which canonical schema a
     * given dataset maps to). This service's job is narrower: confirm
     * the mapping is well-formed and that applying it to a real sample
     * doesn't immediately fail, so an administrator gets fast feedback
     * rather than only discovering a bad mapping when a website visitor
     * sees an empty component.
     */
    async saveMapping(input: unknown, websiteId: string): Promise<Result<DataSourceView, AppError>> {
        const parsed = saveMappingSchema.safeParse(input);

        if (!parsed.success) {
            return err(AppErrors.validation(parsed.error.issues[0]?.message ?? "Ungültige Mapping-Eingabe."));
        }

        const previewResult = await previewMapping(parsed.data.dataSourceId, websiteId, parsed.data.mapping);

        if (!previewResult.ok) return err(previewResult.error);

        if (!previewResult.data.ok) {
            return err(
                AppErrors.validation(
                    `The mapping could not be applied to a live sample: ${
                        previewResult.data.error[0]?.message ?? "unknown error"
                    }`
                )
            );
        }

        return dataSourceRepository.saveMapping(parsed.data.dataSourceId, parsed.data.mapping);
    },

    async previewMapping(
        dataSourceId: string,
        websiteId: string,
        mapping: DatasetMapping
    ): Promise<Result<Result<Record<string, unknown>, MappingFieldError[]>, DataSourceError>> {
        return previewMapping(dataSourceId, websiteId, mapping);
    },
};
