import type { AuthMode } from "@/modules/data-sources/domain/data-source-schema";
import type { Result } from "@/lib/result/result";
import { err, ok } from "@/lib/result/result";

/**
 * Resolves the actual credential value for an authenticated REST data
 * source (Phase 3.5 spec §5, §60).
 *
 * Credentials are NEVER stored in the `DataSource.config` JSON column —
 * only `authMode` is. The secret lives in a server-only environment
 * variable named after the data source's id:
 *
 *   DATASOURCE_<id>_API_KEY=...
 *   DATASOURCE_<id>_BEARER_TOKEN=...
 *
 * This file lives in infrastructure/, not domain/, specifically because
 * it reads the process environment — a runtime concern the domain layer
 * must stay free of.
 */

/** A read-only view of environment variables. `process.env` satisfies it. */
export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

/**
 * Data source ids become part of an environment variable name. Anything
 * outside this set cannot appear in a well-formed variable name, so it is
 * rejected instead of being looked up under a name it could not match.
 * Hyphens (common in cuid/uuid ids) are normalized to underscores.
 */
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

/**
 * Builds the environment variable name that holds a data source's
 * credential, or null when the id cannot be mapped to a valid name.
 */
export function credentialEnvironmentVariableName(
    dataSourceId: string,
    authMode: Exclude<AuthMode, "NONE">
): string | null {
    if (!SAFE_ID.test(dataSourceId)) return null;

    const suffix = authMode === "API_KEY" ? "API_KEY" : "BEARER_TOKEN";

    return `DATASOURCE_${dataSourceId.replace(/-/g, "_")}_${suffix}`;
}

export function resolveCredential(
    dataSourceId: string,
    authMode: AuthMode,
    environment: EnvironmentSource = process.env
): string | null {
    if (authMode === "NONE") return null;

    const variableName = credentialEnvironmentVariableName(dataSourceId, authMode);

    if (variableName === null) return null;

    return environment[variableName] || null;
}

/**
 * Builds the outbound request headers for a REST data source's configured
 * auth mode. Fails closed when a credential is required but missing:
 * sending an unauthenticated request to a source that expects auth would
 * surface as a confusing 401 from the external API instead of a clear
 * local diagnostic.
 */
export function buildAuthHeaders(
    dataSourceId: string,
    authMode: AuthMode,
    environment: EnvironmentSource = process.env
): Result<Record<string, string>, string> {
    if (authMode === "NONE") return ok({});

    const credential = resolveCredential(dataSourceId, authMode, environment);

    if (!credential) {
        return err(
            authMode === "API_KEY"
                ? "API key is not configured for this data source."
                : "Bearer token is not configured for this data source."
        );
    }

    if (authMode === "API_KEY") return ok({ "X-API-Key": credential });

    return ok({ Authorization: `Bearer ${credential}` });
}

/** A function that produces auth headers for a data source; the adapter's seam for credentials. */
export type AuthHeaderProvider = (
    dataSourceId: string,
    authMode: AuthMode
) => Result<Record<string, string>, string>;
