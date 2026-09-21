import type {
    DataSourceAdapter,
    ConnectionTestResult,
    DataDiscoveryResult,
    DiscoveredField,
    DataSourceError,
} from "@/modules/data-sources/domain/data-source-adapter";
import type {
    RestDataSourceConfig,
    ConnectionDiagnosticCategory,
} from "@/modules/data-sources/domain/data-source-schema";
import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import { AppErrors } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";
import { checkOutboundUrl } from "@/modules/data-sources/domain/outbound-url";
import { buildAuthHeaders } from "@/modules/data-sources/infrastructure/credentials";

/** Server-side request timeout for any outbound data-source call (spec §19, §22). */
const REQUEST_TIMEOUT_MS = 10_000;

/** Maximum response body size accepted from an external source (spec §22). */
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB

/** How many sample array items discovery inspects when the response is a list. */
const DISCOVERY_SAMPLE_SIZE = 5;

/**
 * The only `DataSourceAdapter` implementation in this phase (spec §4,
 * §27). Talks to a municipal/civic REST API that returns JSON.
 *
 * Every method here is defensive by construction, since the target URL
 * and response are both untrusted (spec §22 — "treat external data
 * sources as untrusted input"):
 *  - the resolved URL is re-checked with checkOutboundUrl() even though
 *    the settings UI already validates it at save time, because
 *    configuration saved before this check existed (or a DNS record that
 *    changes after save) shouldn't get a permanent pass;
 *  - every request carries a timeout and an upper bound on response size;
 *  - the response is parsed as JSON and never treated as HTML/executable
 *    content (no dangerouslySetInnerHTML anywhere downstream of this
 *    adapter — components render canonical typed fields, not raw HTML).
 */
function categorized(
    category: ConnectionDiagnosticCategory,
    appError: ReturnType<typeof AppErrors.validation>
): DataSourceError {
    return { ...appError, category };
}

class RestJsonAdapter implements DataSourceAdapter {
    async testConnection(
        config: RestDataSourceConfig,
        dataSourceId: string
    ): Promise<Result<ConnectionTestResult, DataSourceError>> {
        const requestResult = await this.request(config, dataSourceId);

        if (!requestResult.ok) return requestResult;

        const { statusCode, responseTimeMs } = requestResult.data;

        return ok({
            statusCode,
            responseTimeMs,
        });
    }

    async discover(
        config: RestDataSourceConfig,
        dataSourceId: string
    ): Promise<Result<DataDiscoveryResult, DataSourceError>> {
        const requestResult = await this.request(config, dataSourceId);

        if (!requestResult.ok) return requestResult;

        const { body } = requestResult.data;
        const sample = Array.isArray(body)
            ? body.slice(0, DISCOVERY_SAMPLE_SIZE)
            : body;
        const representative = Array.isArray(body) ? body[0] : body;

        if (representative === undefined) {
            return ok({
                fields: [],
                sample,
            });
        }

        return ok({
            fields: flattenFields(representative),
            sample,
        });
    }

    async fetch(
        config: RestDataSourceConfig,
        dataSourceId: string
    ): Promise<Result<unknown, DataSourceError>> {
        const requestResult = await this.request(config, dataSourceId);

        if (!requestResult.ok) return requestResult;

        return ok(requestResult.data.body);
    }

    /**
     * Shared request path for all three public methods. Resolves the
     * target URL, checks it against the SSRF guard, attaches auth
     * headers, enforces a timeout and a response-size ceiling, and parses
     * JSON — returning a category-tagged error so callers (the
     * test-connection Server Action, in particular — spec §6) can
     * distinguish connection failure from auth failure from malformed
     * response, rather than one generic error.
     */
    private async request(
        config: RestDataSourceConfig,
        dataSourceId: string
    ): Promise<
        Result<
            {
                statusCode: number;
                responseTimeMs: number;
                body: unknown;
            },
            DataSourceError
        >
    > {
        let targetUrl: URL;

        try {
            targetUrl = new URL(config.path, config.baseUrl);
        } catch {
            return err(
                categorized(
                    "INVALID_CONFIGURATION",
                    AppErrors.validation(
                        "The configured URL is invalid.",
                        "baseUrl"
                    )
                )
            );
        }

        const urlCheck = checkOutboundUrl(targetUrl.toString());

        if (!urlCheck.ok) {
            return err(
                categorized(
                    "INVALID_CONFIGURATION",
                    AppErrors.validation(
                        urlCheck.error,
                        "baseUrl"
                    )
                )
            );
        }

        const authHeaders = buildAuthHeaders(
            dataSourceId,
            config.authMode
        );

        if (!authHeaders.ok) {
            return err(
                categorized(
                    "INVALID_CONFIGURATION",
                    AppErrors.validation(
                        "This data source requires a credential that has not been configured on the server.",
                        "authMode"
                    )
                )
            );
        }

        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            REQUEST_TIMEOUT_MS
        );
        const startedAt = Date.now();

        let response: Response;

        try {
            response = await fetch(targetUrl, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    ...authHeaders.data,
                },
                signal: controller.signal,
                redirect: "error",
            });
        } catch (cause) {
            const responseTimeMs = Date.now() - startedAt;
            clearTimeout(timeout);

            if (controller.signal.aborted) {
                logger.warn("RestJsonAdapter request timed out", {
                    dataSourceId,
                    responseTimeMs,
                });

                return err(
                    categorized(
                        "CONNECTION_FAILED",
                        AppErrors.externalApi(
                            "The request timed out."
                        )
                    )
                );
            }

            logger.warn(
                "RestJsonAdapter request failed to reach the external source",
                {
                    dataSourceId,
                    cause,
                }
            );

            return err(
                categorized(
                    "CONNECTION_FAILED",
                    AppErrors.externalApi(
                        "The data source could not be reached."
                    )
                )
            );
        }

        clearTimeout(timeout);

        const responseTimeMs = Date.now() - startedAt;

        if (response.status === 401 || response.status === 403) {
            return err(
                categorized(
                    "AUTHENTICATION_FAILED",
                    AppErrors.unauthorized()
                )
            );
        }

        if (!response.ok) {
            logger.warn(
                "RestJsonAdapter received a non-OK response",
                {
                    dataSourceId,
                    status: response.status,
                }
            );

            return err(
                categorized(
                    "INVALID_RESPONSE",
                    AppErrors.externalApi(
                        `The data source returned an error (HTTP ${response.status}).`
                    )
                )
            );
        }

        const contentLength = response.headers.get("content-length");

        if (
            contentLength &&
            Number(contentLength) > MAX_RESPONSE_BYTES
        ) {
            return err(
                categorized(
                    "INVALID_RESPONSE",
                    AppErrors.externalApi(
                        "The data source's response was too large."
                    )
                )
            );
        }

        let text: string;

        try {
            text = await readBounded(
                response,
                MAX_RESPONSE_BYTES
            );
        } catch {
            return err(
                categorized(
                    "INVALID_RESPONSE",
                    AppErrors.externalApi(
                        "The data source's response was too large."
                    )
                )
            );
        }

        let body: unknown;

        try {
            body = JSON.parse(text);
        } catch {
            return err(
                categorized(
                    "INVALID_RESPONSE",
                    AppErrors.externalApi(
                        "The data source did not return valid JSON."
                    )
                )
            );
        }

        return ok({
            statusCode: response.status,
            responseTimeMs,
            body,
        });
    }
}

/**
 * Reads a Response body as text, aborting once it exceeds `maxBytes`
 * rather than buffering an unbounded stream.
 */
async function readBounded(
    response: Response,
    maxBytes: number
): Promise<string> {
    if (!response.body) return response.text();

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    for (;;) {
        const { done, value } = await reader.read();

        if (done) break;

        total += value.byteLength;

        if (total > maxBytes) {
            await reader.cancel();
            throw new Error(
                "Response exceeded maximum allowed size."
            );
        }

        chunks.push(value);
    }

    return Buffer.concat(
        chunks.map((c) => Buffer.from(c))
    ).toString("utf-8");
}

/**
 * Flattens one sample record into dot-path fields for the discovery UI
 * (spec §7). Depth-limited and item-limited so a deeply nested or very
 * wide external record can't produce an unusable (or resource-heavy)
 * field list — municipal/smart-city APIs are not expected to nest more
 * than a few levels deep in practice.
 */
const MAX_DISCOVERY_DEPTH = 4;
const MAX_DISCOVERY_FIELDS = 200;

function flattenFields(
    value: unknown,
    prefix = "",
    depth = 0,
    out: DiscoveredField[] = []
): DiscoveredField[] {
    if (out.length >= MAX_DISCOVERY_FIELDS) return out;

    if (value === null) {
        out.push({
            path: prefix,
            sampleType: "null",
            sampleValue: "null",
        });

        return out;
    }

    if (Array.isArray(value)) {
        if (
            depth >= MAX_DISCOVERY_DEPTH ||
            value.length === 0
        ) {
            out.push({
                path: prefix,
                sampleType: "array",
                sampleValue: `[${value.length} item(s)]`,
            });

            return out;
        }

        // Discover the shape of the first item, using "[0]" as a
        // representative index — the mapping UI maps by shape, not by
        // literal array index, so one sample is sufficient here.
        flattenFields(
            value[0],
            `${prefix}[0]`,
            depth + 1,
            out
        );

        return out;
    }

    if (typeof value === "object") {
        if (depth >= MAX_DISCOVERY_DEPTH) {
            out.push({
                path: prefix,
                sampleType: "object",
                sampleValue: "{…}",
            });

            return out;
        }

        for (const [key, nested] of Object.entries(
            value as Record<string, unknown>
        )) {
            if (out.length >= MAX_DISCOVERY_FIELDS) break;

            flattenFields(
                nested,
                prefix ? `${prefix}.${key}` : key,
                depth + 1,
                out
            );
        }

        return out;
    }

    const sampleType =
        typeof value === "number"
            ? "number"
            : typeof value === "boolean"
              ? "boolean"
              : "string";

    const preview = String(value);

    out.push({
        path: prefix,
        sampleType,
        sampleValue:
            preview.length > 80
                ? `${preview.slice(0, 80)}…`
                : preview,
    });

    return out;
}

export const restJsonAdapter: DataSourceAdapter =
    new RestJsonAdapter();
