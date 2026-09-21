import type { Result } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import type { RestDataSourceConfig, ConnectionDiagnosticCategory } from "@/modules/data-sources/domain/data-source-schema";

/** Outcome of a successful "Test Connection" (Phase 3.5 spec §6). */
export type ConnectionTestResult = {
    /** HTTP status code returned by the external source, for diagnostics. */
    statusCode: number;
    /** Round-trip time in milliseconds, shown in the settings UI. */
    responseTimeMs: number;
};

/**
 * A test-connection/fetch failure, carrying both the standard `AppError`
 * (for logging and the generic Result/AppError pipeline used everywhere
 * else) and a `category` the settings UI uses to show one of spec §6's
 * four distinct messages ("Connection failed" / "Authentication failed"
 * / "Invalid response" / "Invalid configuration") instead of one generic
 * error. The adapter assigns `category` at the point it knows the
 * failure's real nature — see the request() method in
 * rest-json-adapter.ts — rather than a caller guessing it back from
 * `error.code` after the fact.
 */
export type DataSourceError = AppError & { category: ConnectionDiagnosticCategory };

/**
 * A single field discovered in a sample external record, flattened to a
 * dot path (spec §7 — "identify available fields"). This is discovery
 * output only, shown to an administrator building a mapping — never
 * itself treated as canonical data.
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
    /** The raw sample record(s) the fields were inferred from, for the mapping UI's live preview. */
    sample: unknown;
};

/**
 * The contract every data source connector kind implements (Phase 3.5
 * spec §27). A component or provider never talks to `fetch()` or a
 * specific external API directly — everything server-side that reaches
 * an external civic/smart-city source goes through an adapter
 * implementing this interface.
 *
 * Implementations:
 *  - RestJsonAdapter (infrastructure/adapters/rest-json-adapter.ts) — the
 *    only implementation in this phase (spec §4: "Start with the most
 *    useful practical integration: REST/JSON").
 *  - Future: CkanAdapter, GeoJsonAdapter, etc., each implementing this
 *    same three-method contract.
 */
export interface DataSourceAdapter {
    testConnection(config: RestDataSourceConfig, dataSourceId: string): Promise<Result<ConnectionTestResult, DataSourceError>>;

    discover(config: RestDataSourceConfig, dataSourceId: string): Promise<Result<DataDiscoveryResult, DataSourceError>>;

    /**
     * Fetches the raw (unmapped, unvalidated) external data for a
     * dataset. Callers apply field mapping and canonical Zod validation
     * afterward — this method's only job is "get the external JSON
     * safely", matching the adapter/mapping split in spec §8's pipeline
     * diagram.
     */
    fetch(config: RestDataSourceConfig, dataSourceId: string): Promise<Result<unknown, DataSourceError>>;
}
