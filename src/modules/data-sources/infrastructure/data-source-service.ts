import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { AppErrors } from "@/lib/errors/app-error";
import { dataSourceRepository, type DataSourceRow } from "@/modules/data-sources/infrastructure/data-source-repository";
import { restJsonAdapter } from "@/modules/data-sources/infrastructure/adapters/rest-json-adapter";
import type {
    DataSourceAdapter,
    DataSourceError,
    DataDiscoveryResult,
} from "@/modules/data-sources/domain/data-source-adapter";
import {
    createDataSourceSchema,
    saveMappingSchema,
    validateDataSourceConfig,
    restDataSourceConfigSchema,
    type DataSourceKind,
} from "@/modules/data-sources/domain/data-source-schema";
import {
    applyMapping,
    type DatasetMapping,
    type MappingFieldError,
} from "@/modules/data-sources/domain/field-mapping-schema";
import { checkOutboundUrl } from "@/modules/data-sources/domain/outbound-url";
import { Prisma } from "@prisma/client";

export type { DataSourceRow };

/**
 * Resolves which adapter implementation handles a given data source kind
 * (spec §27). MOCK and GRAPHQL have no adapter — MOCK is served directly
 * by the mock civic/smart-city providers (see
 * civic/infrastructure/adapters), and GRAPHQL has no implementation yet
 * (spec §4 scopes this phase to REST/JSON only).
 */
function adapterForKind(kind: DataSourceKind): DataSourceAdapter | null {
    return kind === "REST" ? restJsonAdapter : null;
}

/**
 * Application service for the Data Sources settings area (spec §3–§9).
 * Every method validates input with Zod before touching the repository or
 * an adapter, and returns `Result<T, AppError>` — the Server Actions in
 * application/data-source-actions.ts are thin wrappers around this.
 */
export const dataSourceService = {
    async listForWebsite(
        websiteId: string
    ): Promise<Result<DataSourceRow[], AppError>> {
        return dataSourceRepository.findByWebsite(websiteId);
    },

    /**
     * Creates or replaces the one data source configured for a
     * (website, dataset) pair (spec §24 steps 2–4). Validates the
     * top-level shape first, then the `config` blob against the schema
     * for the chosen `kind` — a REST source can't be saved with
     * GraphQL-shaped config, and neither can be saved with a stray
     * credential in `config` (restDataSourceConfigSchema is `.strict()`,
     * so an extra `apiKey` field is rejected rather than silently stored)
     * — and finally, for REST sources, the SSRF guard (spec §22), so a
     * private-network or metadata-endpoint URL is rejected at save time
     * with a clear message rather than only failing later on first test
     * or fetch. The adapter re-checks the same guard at request time
     * regardless (see rest-json-adapter.ts) — this is a defense-in-depth
     * duplicate, not a replacement for that check, since a URL valid at
     * save time is not guaranteed to stay so (e.g. a DNS record change).
     */
    async upsert(
        input: unknown
    ): Promise<Result<DataSourceRow, AppError>> {
        const parsed = createDataSourceSchema.safeParse(input);

        if (!parsed.success) {
            return err(
                AppErrors.validation(
                    parsed.error.issues[0]?.message ??
                    "Invalid data source input."
                )
            );
        }

        const configResult = validateDataSourceConfig(
            parsed.data.kind,
            parsed.data.config
        );

        if (!configResult.ok) {
            return err(
                AppErrors.validation(
                    configResult.error,
                    "config"
                )
            );
        }

        if (parsed.data.kind === "REST") {
            const restConfig =
                restDataSourceConfigSchema.parse(
                    configResult.data
                );

            // Check the RESOLVED url (baseUrl + path combined), not baseUrl
            // alone: `path` can itself be an absolute or protocol-relative
            // URL, in which case `new URL(path, baseUrl)` uses path's own
            // host and silently ignores baseUrl entirely (confirmed
            // behavior of the URL constructor) — so validating baseUrl in
            // isolation would miss a private-network target smuggled in
            // via `path`. rest-json-adapter.ts re-checks this same
            // resolved URL at request time regardless (defense in depth);
            // this save-time check exists purely so a misconfigured source
            // is rejected immediately with a clear message instead of only
            // failing on the first test/fetch.
            let resolvedUrl: string;

            try {
                resolvedUrl = new URL(
                    restConfig.path,
                    restConfig.baseUrl
                ).toString();
            } catch {
                return err(
                    AppErrors.validation(
                        "The configured URL is invalid.",
                        "config.baseUrl"
                    )
                );
            }

            const urlCheck = checkOutboundUrl(resolvedUrl);

            if (!urlCheck.ok) {
                return err(
                    AppErrors.validation(
                        urlCheck.error,
                        "config.baseUrl"
                    )
                );
            }
        }

        return dataSourceRepository.upsert({
            websiteId: parsed.data.websiteId,
            dataset: parsed.data.dataset,
            name: parsed.data.name,
            kind: parsed.data.kind,
            // Cast to Prisma.InputJsonValue at the infrastructure boundary:
            // validateDataSourceConfig returns Record<string, unknown> (domain-safe),
            // which is structurally compatible but needs this annotation for Prisma.
            config: configResult.data as Prisma.InputJsonValue,
        });
    },

    async delete(
        dataSourceId: string
    ): Promise<Result<void, AppError>> {
        return dataSourceRepository.delete(dataSourceId);
    },

    /**
     * Runs "Test Connection" for a saved data source (spec §6) and
     * records the outcome for the settings UI's "Last synchronized" /
     * status display (spec §3, §29). Returns the adapter's category-tagged
     * `DataSourceError` on failure — deliberately not the generic
     * `Result<T, AppError>` used elsewhere — so the settings UI can show
     * one of the four distinct messages spec §6 asks for.
     */
    async testConnection(
        dataSourceId: string
    ): Promise<
        Result<
            {
                statusCode: number;
                responseTimeMs: number;
            },
            DataSourceError
        >
    > {
        const rowResult =
            await dataSourceRepository.findById(dataSourceId);

        if (!rowResult.ok) {
            return err({
                ...rowResult.error,
                category: "CONNECTION_FAILED",
            });
        }

        if (!rowResult.data) {
            return err({
                ...AppErrors.notFound("Data source"),
                category: "CONNECTION_FAILED",
            });
        }

        const row = rowResult.data;
        const adapter = adapterForKind(row.kind);

        if (!adapter) {
            return err({
                ...AppErrors.validation(
                    `No connector is available for data sources of kind "${row.kind}" yet.`
                ),
                category: "INVALID_CONFIGURATION",
            });
        }

        const configParsed =
            restDataSourceConfigSchema.safeParse(row.config);

        if (!configParsed.success) {
            return err({
                ...AppErrors.validation(
                    "This data source's saved configuration is no longer valid."
                ),
                category: "INVALID_CONFIGURATION",
            });
        }

        const testResult = await adapter.testConnection(
            configParsed.data,
            row.id
        );

        // Persist the outcome regardless of success/failure so the settings
        // list's status badge and "last checked" timestamp stay current
        // (spec §3, §29). A failure to WRITE the diagnostic (e.g. a DB
        // hiccup) doesn't override the actual test outcome returned to the
        // caller — it's logged by the repository and otherwise ignored here.
        await dataSourceRepository.recordTestResult(row.id, {
            status: testResult.ok ? "OK" : "ERROR",
            lastError: testResult.ok
                ? null
                : testResult.error.message,
        });

        return testResult;
    },

    /**
     * Retrieves a sample of external data and flattens its available
     * fields for the mapping UI (spec §7). Read-only — never writes
     * anything, unlike testConnection, since discovery can be run
     * speculatively while an administrator is exploring a source.
     */
    async discover(
        dataSourceId: string
    ): Promise<
        Result<DataDiscoveryResult, DataSourceError>
    > {
        const rowResult =
            await dataSourceRepository.findById(dataSourceId);

        if (!rowResult.ok) {
            return err({
                ...rowResult.error,
                category: "CONNECTION_FAILED",
            });
        }

        if (!rowResult.data) {
            return err({
                ...AppErrors.notFound("Data source"),
                category: "CONNECTION_FAILED",
            });
        }

        const row = rowResult.data;
        const adapter = adapterForKind(row.kind);

        if (!adapter) {
            return err({
                ...AppErrors.validation(
                    `No connector is available for data sources of kind "${row.kind}" yet.`
                ),
                category: "INVALID_CONFIGURATION",
            });
        }

        const configParsed =
            restDataSourceConfigSchema.safeParse(row.config);

        if (!configParsed.success) {
            return err({
                ...AppErrors.validation(
                    "This data source's saved configuration is no longer valid."
                ),
                category: "INVALID_CONFIGURATION",
            });
        }

        return adapter.discover(
            configParsed.data,
            row.id
        );
    },

    /**
     * Validates and saves a field mapping for a data source (spec §9,
     * §10). Before saving, this fetches a live sample and runs the
     * mapping against it end-to-end (map → nothing more — canonical Zod
     * validation of the *mapped* records happens per-dataset in each
     * provider, e.g. rest-civic-provider.ts, since only that provider
     * knows which canonical schema a given dataset maps to). This
     * service's job is narrower: confirm the mapping is well-formed and
     * that applying it to a real sample doesn't immediately fail, so an
     * administrator gets fast feedback rather than only discovering a
     * bad mapping when a website visitor sees an empty component.
     */
    async saveMapping(
        input: unknown
    ): Promise<Result<DataSourceRow, AppError>> {
        const parsed = saveMappingSchema.safeParse(input);

        if (!parsed.success) {
            return err(
                AppErrors.validation(
                    parsed.error.issues[0]?.message ??
                    "Invalid mapping input."
                )
            );
        }

        const previewResult = await this.previewMapping(
            parsed.data.dataSourceId,
            parsed.data.mapping
        );

        if (!previewResult.ok) {
            return err(previewResult.error);
        }

        if (!previewResult.data.ok) {
            return err(
                AppErrors.validation(
                    `The mapping could not be applied to a live sample: ${previewResult.data.error[0]?.message ??
                    "unknown error"
                    }`
                )
            );
        }

        return dataSourceRepository.saveMapping(
            parsed.data.dataSourceId,
            parsed.data.mapping
        );
    },

    /**
     * Applies a candidate mapping to one live sample record from the
     * source, without saving anything — used by both saveMapping's
     * validation step above and the mapping UI's live preview (spec §9's
     * "Map Event Data" screen showing the mapped result as fields are
     * configured).
     */
    async previewMapping(
        dataSourceId: string,
        mapping: DatasetMapping
    ): Promise<
        Result<
            Result<Record<string, unknown>, MappingFieldError[]>,
            DataSourceError
        >
    > {
        const discoveryResult =
            await this.discover(dataSourceId);

        if (!discoveryResult.ok) {
            return discoveryResult;
        }

        const { sample } = discoveryResult.data;
        const record = Array.isArray(sample)
            ? sample[0]
            : sample;

        if (record === undefined) {
            return err({
                ...AppErrors.validation(
                    "The data source returned no sample records to preview against."
                ),
                category: "INVALID_RESPONSE",
            });
        }

        return ok(applyMapping(mapping, record));
    },
};
