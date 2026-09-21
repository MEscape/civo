import type { AuthMode } from "@/modules/data-sources/domain/data-source-schema";
import type { Result } from "@/lib/result/result";
import { err, ok } from "@/lib/result/result";

/**
 * Resolves the actual credential value for an authenticated REST data
 * source (Phase 3.5 spec §5, §60).
 *
 * Credentials are NEVER stored in the `DataSource.config` JSON column —
 * only `authMode` is (see restDataSourceConfigSchema). The secret itself
 * lives in a server-only environment variable named after the data
 * source's id, e.g.:
 *
 *   DATASOURCE_<id>_API_KEY=...
 *   DATASOURCE_<id>_BEARER_TOKEN=...
 *
 * This keeps secrets out of every place `DataSource` rows are ever read
 * from in this codebase — Server Actions, the settings UI, page
 * configuration, generated website code — since none of those touch
 * `process.env`. It also means secrets are never written by
 * application code, avoiding an entire class of "was this JSON column
 * ever logged/cached/echoed back to a client" concerns.
 *
 * This file lives in infrastructure/, not domain/, specifically because
 * it reads `process.env` — a Node/runtime concern the domain layer must
 * stay free of.
 */
export function resolveCredential(
    dataSourceId: string,
    authMode: AuthMode
): string | null {
    if (authMode === "NONE") return null;

    const envVarName =
        authMode === "API_KEY"
            ? `DATASOURCE_${dataSourceId}_API_KEY`
            : `DATASOURCE_${dataSourceId}_BEARER_TOKEN`;

    return process.env[envVarName] || null;
}

/**
 * Builds the outbound request headers for a REST data source's configured
 * auth mode.
 *
 * Returns a shared `Result` so the infrastructure layer uses the same
 * expected-failure convention as the rest of the application.
 *
 * When a credential is required but not configured, the operation fails
 * closed — sending an unauthenticated request to a source that expects
 * auth would just surface as a confusing 401 from the external API
 * instead of a clear local diagnostic.
 */
export function buildAuthHeaders(
    dataSourceId: string,
    authMode: AuthMode
): Result<Record<string, string>, string> {
    if (authMode === "NONE") {
        return ok({});
    }

    const credential = resolveCredential(dataSourceId, authMode);

    if (!credential) {
        return err(
            authMode === "API_KEY"
                ? "API key is not configured for this data source."
                : "Bearer token is not configured for this data source."
        );
    }

    if (authMode === "API_KEY") {
        return ok({
            "X-API-Key": credential,
        });
    }

    return ok({
        Authorization: `Bearer ${credential}`,
    });
}
