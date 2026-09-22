import type { Result } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import type { ConnectionDiagnosticCategory } from "@/modules/data-sources/domain/data-source-schema";

/** Outcome of a successful "Test Connection" (Phase 3.5 spec §6). */
export type ConnectionTestResult = {
    /** HTTP status code returned by the external source, for diagnostics. */
    statusCode: number;
    /** Round-trip time in milliseconds, shown in the settings UI. */
    responseTimeMs: number;
};

/**
 * A test-connection/fetch failure. Carries the standard `AppError` (for
 * logging and the generic Result pipeline) plus a `category` the settings
 * UI uses to show one of spec §6's four distinct messages. The adapter
 * assigns `category` where it knows the failure's real nature rather than
 * a caller guessing it back from `error.code`.
 */
export type DataSourceError = AppError & { category: ConnectionDiagnosticCategory };

/**
 * A single field discovered in a sample external record, flattened to a
 * dot path (spec §7). Discovery output only — shown to an administrator
 * building a mapping, never itself treated as canonical data.
 */
export type DiscoveredField = {
    path: string;
    /** A coarse type hint inferred from the sample value, to guide mapping UI defaults. */
    sampleType: "string" | "number" | "boolean" | "array" | "object" | "null";
    /** A short preview of the value, truncated — never the full value for large fields. */
    sampleValue: string;
};

export type DataDiscoveryResult = {
    fields: DiscoveredField[];
    /**
     * The raw sample record(s) the fields were inferred from, for the
     * mapping UI's live preview. Always an array of records (empty when
     * the source returned none), so callers never branch on shape.
     */
    sample: unknown[];
};

/**
 * Identifies one configured data source to an adapter. The id is what an
 * adapter needs to look up server-side secrets; it is not a database
 * concern.
 */
export type DataSourceContext = {
    dataSourceId: string;
};

/**
 * The contract every data source connector kind implements (spec §27).
 * A component or provider never talks to `fetch()` or a specific external
 * API directly — everything server-side that reaches an external
 * civic/smart-city source goes through an adapter implementing this.
 *
 * Generic over `TConfig` so each connector kind declares its own
 * configuration shape, and owns parsing it: the application layer hands
 * an adapter the untrusted persisted blob and gets a typed config or a
 * diagnostic back, instead of choosing a schema on the adapter's behalf.
 *
 * Implementations:
 *  - RestJsonAdapter (infrastructure/adapters/rest-json-adapter.ts)
 *  - Future: CkanAdapter, GeoJsonAdapter, each with its own TConfig.
 */
export interface DataSourceAdapter<TConfig = unknown> {
    /** Validates the persisted config blob for this connector kind. */
    parseConfig(rawConfig: unknown): Result<TConfig, string>;

    testConnection(
        config: TConfig,
        context: DataSourceContext
    ): Promise<Result<ConnectionTestResult, DataSourceError>>;

    discover(config: TConfig, context: DataSourceContext): Promise<Result<DataDiscoveryResult, DataSourceError>>;

    /**
     * Fetches the raw (unmapped, unvalidated) external data for a
     * dataset. Callers apply field mapping and canonical Zod validation
     * afterward — this method's only job is "get the external JSON
     * safely", matching the adapter/mapping split in spec §8.
     */
    fetch(config: TConfig, context: DataSourceContext): Promise<Result<unknown, DataSourceError>>;
}
