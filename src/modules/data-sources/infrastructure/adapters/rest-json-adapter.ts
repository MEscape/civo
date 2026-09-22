import { lookup } from "node:dns/promises";
import type {
    DataSourceAdapter,
    DataSourceContext,
    DataSourceError,
    ConnectionTestResult,
    DataDiscoveryResult,
    DiscoveredField,
} from "@/modules/data-sources/domain/data-source-adapter";
import {
    restDataSourceConfigSchema,
    type ConnectionDiagnosticCategory,
    type RestDataSourceConfig,
} from "@/modules/data-sources/domain/data-source-schema";
import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import { AppErrors, type AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";
import { checkResolvedAddress } from "@/modules/data-sources/domain/outbound-url";
import { resolveRestUrl } from "@/modules/data-sources/domain/resolve-rest-url";
import { buildAuthHeaders, type AuthHeaderProvider } from "@/modules/data-sources/infrastructure/credentials";

/** Server-side request timeout for any outbound data-source call (spec §19, §22). */
export const REQUEST_TIMEOUT_MS = 10_000;

/** Maximum response body size accepted from an external source (spec §22). */
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB

/** How many sample records discovery inspects when the response is a list. */
const DISCOVERY_SAMPLE_SIZE = 5;

const MAX_DISCOVERY_DEPTH = 4;
const MAX_DISCOVERY_FIELDS = 200;
const MAX_SAMPLE_PREVIEW_LENGTH = 80;

/** Resolves a hostname to every address it currently maps to. */
export type HostResolver = (hostname: string) => Promise<string[]>;

const resolveWithDns: HostResolver = async (hostname) => {
    const records = await lookup(hostname, { all: true, verbatim: true });

    return records.map((record) => record.address);
};

export type RestJsonAdapterDependencies = {
    /** Supplies auth headers; defaults to reading server-side environment variables. */
    authHeaders?: AuthHeaderProvider;
    /** Resolves hostnames for the DNS-rebinding guard; defaults to `dns.lookup`. */
    resolveHost?: HostResolver;
    /** The fetch implementation; defaults to the global `fetch` looked up at call time. */
    fetchImplementation?: typeof fetch;
};

/**
 * Accepts either the context object or the bare data source id string.
 * Callers written against the earlier `(config, dataSourceId)` signature
 * keep working; new callers pass a `DataSourceContext`.
 */
function toContext(context: DataSourceContext | string): DataSourceContext {
    return typeof context === "string" ? { dataSourceId: context } : context;
}

function categorized(category: ConnectionDiagnosticCategory, appError: AppError): DataSourceError {
    return { ...appError, category };
}

function failure(category: ConnectionDiagnosticCategory, appError: AppError): Result<never, DataSourceError> {
    return err(categorized(category, appError));
}

type RestResponse = {
    statusCode: number;
    responseTimeMs: number;
    body: unknown;
};

function isIpLiteral(hostname: string): boolean {
    return hostname.includes(":") || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

/**
 * Talks to a municipal/civic REST API that returns JSON — the only
 * `DataSourceAdapter` implementation in this phase (spec §4, §27).
 *
 * The target URL and the response are both untrusted (spec §22), so every
 * request is defensive by construction:
 *  - the resolved URL is re-checked against the SSRF policy on every
 *    request, because configuration saved before a check existed, or a
 *    DNS record that changes after save, must not get a permanent pass;
 *  - the hostname is resolved and EVERY returned address is checked, so a
 *    public-looking name that points at a private address is refused;
 *  - every request carries a timeout, never follows redirects, and reads
 *    the body with a hard size ceiling;
 *  - the body is parsed as JSON and never treated as HTML/executable
 *    content.
 *
 * Known residual gap: the address check and `fetch`'s own connection each
 * perform a DNS lookup, so a resolver that answers differently between the
 * two could still slip through. Closing that fully needs socket-level
 * address pinning (an undici `Agent` with a custom `lookup`), which can be
 * supplied through `fetchImplementation` without touching call sites.
 * Pair this adapter with an egress allowlist at the network layer for
 * production hardening (spec §22).
 */
export class RestJsonAdapter implements DataSourceAdapter<RestDataSourceConfig> {
    private readonly authHeaders: AuthHeaderProvider;
    private readonly resolveHost: HostResolver;
    private readonly fetchImplementation: typeof fetch | undefined;

    constructor(dependencies: RestJsonAdapterDependencies = {}) {
        this.authHeaders = dependencies.authHeaders ?? ((id, mode) => buildAuthHeaders(id, mode));
        this.resolveHost = dependencies.resolveHost ?? resolveWithDns;
        this.fetchImplementation = dependencies.fetchImplementation;
    }

    parseConfig(rawConfig: unknown): Result<RestDataSourceConfig, string> {
        const parsed = restDataSourceConfigSchema.safeParse(rawConfig);

        if (!parsed.success) {
            return err(parsed.error.issues[0]?.message ?? "Ungültige REST-Datenquellenkonfiguration.");
        }

        return ok(parsed.data);
    }

    async testConnection(
        config: RestDataSourceConfig,
        context: DataSourceContext | string
    ): Promise<Result<ConnectionTestResult, DataSourceError>> {
        const response = await this.request(config, toContext(context));

        if (!response.ok) return response;

        return ok({
            statusCode: response.data.statusCode,
            responseTimeMs: response.data.responseTimeMs,
        });
    }

    async discover(
        config: RestDataSourceConfig,
        context: DataSourceContext | string
    ): Promise<Result<DataDiscoveryResult, DataSourceError>> {
        const response = await this.request(config, toContext(context));

        if (!response.ok) return response;

        const sample = toSampleRecords(response.data.body);

        return ok({ fields: discoverFields(sample), sample });
    }

    async fetch(
        config: RestDataSourceConfig,
        context: DataSourceContext | string
    ): Promise<Result<unknown, DataSourceError>> {
        const response = await this.request(config, toContext(context));

        if (!response.ok) return response;

        return ok(response.data.body);
    }

    /**
     * Shared request path for all public methods. Returns a
     * category-tagged error so callers can distinguish connection failure
     * from auth failure from a malformed response (spec §6).
     */
    private async request(
        config: RestDataSourceConfig,
        { dataSourceId }: DataSourceContext
    ): Promise<Result<RestResponse, DataSourceError>> {
        const targetUrl = resolveRestUrl(config);

        if (!targetUrl.ok) {
            return failure("INVALID_CONFIGURATION", AppErrors.validation(targetUrl.error, "baseUrl"));
        }

        const addressCheck = await this.checkResolvedAddresses(targetUrl.data, dataSourceId);

        if (!addressCheck.ok) return addressCheck;

        const authHeaders = this.authHeaders(dataSourceId, config.authMode);

        if (!authHeaders.ok) {
            return failure(
                "INVALID_CONFIGURATION",
                AppErrors.validation(
                    "Diese Datenquelle erfordert Anmeldeinformationen, die nicht auf dem Server konfiguriert wurden.",
                    "authMode"
                )
            );
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        const startedAt = Date.now();

        try {
            return await this.exchange(targetUrl.data, authHeaders.data, controller, dataSourceId, startedAt);
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * Sends the request and reads the response. The timeout stays armed
     * until the body has been fully read, so a server that answers its
     * headers promptly and then trickles the body cannot hold the request
     * open past the limit.
     */
    private async exchange(
        targetUrl: URL,
        authHeaders: Record<string, string>,
        controller: AbortController,
        dataSourceId: string,
        startedAt: number
    ): Promise<Result<RestResponse, DataSourceError>> {
        const send = this.fetchImplementation ?? fetch;

        let response: Response;

        try {
            response = await send(targetUrl, {
                method: "GET",
                headers: { Accept: "application/json", ...authHeaders },
                signal: controller.signal,
                redirect: "error",
            });
        } catch (cause) {
            return this.connectionFailure(cause, controller, dataSourceId, Date.now() - startedAt);
        }

        const headersReceivedAt = Date.now();

        if (response.status === 401 || response.status === 403) {
            await discardBody(response);

            return failure("AUTHENTICATION_FAILED", AppErrors.unauthorized());
        }

        if (!response.ok) {
            await discardBody(response);

            logger.warn("RestJsonAdapter received a non-OK response", { dataSourceId, status: response.status });

            return failure(
                "INVALID_RESPONSE",
                AppErrors.externalApi(`Die Datenquelle hat einen Fehler zurückgegeben (HTTP ${response.status}).`)
            );
        }

        const declaredLength = Number(response.headers.get("content-length"));

        if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
            await discardBody(response);

            return failure("INVALID_RESPONSE", AppErrors.externalApi("Die Antwort der Datenquelle war zu groß."));
        }

        const text = await readBounded(response, MAX_RESPONSE_BYTES);

        if (!text.ok) {
            if (controller.signal.aborted) {
                return this.connectionFailure(undefined, controller, dataSourceId, Date.now() - startedAt);
            }

            return failure("INVALID_RESPONSE", AppErrors.externalApi(text.error));
        }

        const body = parseJson(text.data);

        if (!body.ok) {
            return failure("INVALID_RESPONSE", AppErrors.externalApi("Die Datenquelle hat kein gültiges JSON zurückgegeben."));
        }

        return ok({
            statusCode: response.status,
            responseTimeMs: headersReceivedAt - startedAt,
            body: body.data,
        });
    }

    private connectionFailure(
        cause: unknown,
        controller: AbortController,
        dataSourceId: string,
        elapsedMs: number
    ): Result<never, DataSourceError> {
        if (controller.signal.aborted) {
            logger.warn("RestJsonAdapter request timed out", { dataSourceId, responseTimeMs: elapsedMs });

            return failure("CONNECTION_FAILED", AppErrors.externalApi("Die Zeitüberschreitung der Anforderung wurde erreicht."));
        }

        logger.warn("RestJsonAdapter request failed to reach the external source", { dataSourceId, cause });

        return failure("CONNECTION_FAILED", AppErrors.externalApi("Die Datenquelle konnte nicht erreicht werden."));
    }

    /**
     * DNS-rebinding guard: a hostname that passed the URL check may still
     * resolve to a private address. Resolves it and requires EVERY
     * returned address to be public — a mix of public and private records
     * is a known evasion.
     */
    private async checkResolvedAddresses(
        targetUrl: URL,
        dataSourceId: string
    ): Promise<Result<void, DataSourceError>> {
        const hostname = targetUrl.hostname.replace(/^\[|\]$/g, "");

        // Literal IPs were already policy-checked by resolveRestUrl.
        if (isIpLiteral(hostname)) return ok(undefined);

        let addresses: string[];

        try {
            addresses = await this.resolveHost(hostname);
        } catch (cause) {
            logger.warn("RestJsonAdapter could not resolve the data source host", { dataSourceId, cause });

            return failure("CONNECTION_FAILED", AppErrors.externalApi("Die Datenquelle konnte nicht erreicht werden."));
        }

        if (addresses.length === 0) {
            return failure("CONNECTION_FAILED", AppErrors.externalApi("Die Datenquelle konnte nicht erreicht werden."));
        }

        const blocked = addresses.find((address) => !checkResolvedAddress(address).ok);

        if (blocked !== undefined) {
            logger.warn("RestJsonAdapter refused a host that resolves to a non-public address", {
                dataSourceId,
                hostname,
            });

            return failure(
                "INVALID_CONFIGURATION",
                AppErrors.validation("Diese Adresse ist nicht erlaubt.", "baseUrl")
            );
        }

        return ok(undefined);
    }
}

function parseJson(text: string): Result<unknown, string> {
    try {
        return ok(JSON.parse(text));
    } catch {
        return err("Die Antwort ist kein gültiges JSON.");
    }
}

/** Releases a response body we are not going to read, so the connection is not held open. */
async function discardBody(response: Response): Promise<void> {
    try {
        await response.body?.cancel();
    } catch {
        // Nothing useful to do if cancelling an already-failed stream fails.
    }
}

/**
 * Reads a response body as text, stopping as soon as it exceeds
 * `maxBytes` rather than buffering an unbounded stream. Returns a Result:
 * exceeding the limit is an expected outcome, not an exception.
 */
async function readBounded(response: Response, maxBytes: number): Promise<Result<string, string>> {
    if (!response.body) return ok(await response.text());

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    try {
        for (;;) {
            const { done, value } = await reader.read();

            if (done) break;

            total += value.byteLength;

            if (total > maxBytes) {
                await reader.cancel();

                return err("Die Antwort der Datenquelle war zu groß.");
            }

            chunks.push(value);
        }
    } catch {
        return err("Die Antwort der Datenquelle konnte nicht gelesen werden.");
    }

    return ok(Buffer.concat(chunks).toString("utf-8"));
}

/**
 * Normalizes a parsed body to a list of sample records: the first few
 * items of a top-level array, or a single-element list for an object.
 * An empty array (or a bare `null`) yields no samples.
 */
function toSampleRecords(body: unknown): unknown[] {
    if (Array.isArray(body)) return body.slice(0, DISCOVERY_SAMPLE_SIZE);

    if (body === null || body === undefined) return [];

    return [body];
}

/**
 * Discovers the union of fields across all sampled records, so an
 * optional field that is missing from the first record but present in a
 * later one is still offered to the administrator. Each path keeps the
 * first sample value seen.
 */
function discoverFields(sample: readonly unknown[]): DiscoveredField[] {
    const byPath = new Map<string, DiscoveredField>();

    for (const record of sample) {
        for (const field of flattenFields(record)) {
            if (byPath.size >= MAX_DISCOVERY_FIELDS) return [...byPath.values()];

            if (!byPath.has(field.path)) byPath.set(field.path, field);
        }
    }

    return [...byPath.values()];
}

function truncate(preview: string): string {
    return preview.length > MAX_SAMPLE_PREVIEW_LENGTH ? `${preview.slice(0, MAX_SAMPLE_PREVIEW_LENGTH)}…` : preview;
}

/**
 * Flattens one sample record into dot-path fields for the discovery UI
 * (spec §7). Depth- and count-limited so a deeply nested or very wide
 * external record cannot produce an unusable or resource-heavy list.
 *
 * Nested arrays are reported as a single `array` field rather than
 * descended into: a mapping path such as `items[0].name` would only ever
 * read the first element, which is misleading, so the UI is not offered
 * one. Only top-level list responses are treated as lists of records.
 */
export function flattenFields(
    value: unknown,
    prefix = "",
    depth = 0,
    out: DiscoveredField[] = []
): DiscoveredField[] {
    if (out.length >= MAX_DISCOVERY_FIELDS) return out;

    if (value === null) {
        if (prefix !== "") out.push({ path: prefix, sampleType: "null", sampleValue: "null" });

        return out;
    }

    if (Array.isArray(value)) {
        if (prefix !== "") {
            out.push({ path: prefix, sampleType: "array", sampleValue: `[${value.length} item(s)]` });
        }

        return out;
    }

    if (typeof value === "object") {
        if (depth >= MAX_DISCOVERY_DEPTH) {
            if (prefix !== "") out.push({ path: prefix, sampleType: "object", sampleValue: "{…}" });

            return out;
        }

        for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
            if (out.length >= MAX_DISCOVERY_FIELDS) break;

            flattenFields(nested, prefix ? `${prefix}.${key}` : key, depth + 1, out);
        }

        return out;
    }

    // A primitive at the root has no field name to map from.
    if (prefix === "") return out;

    const sampleType = typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string";

    out.push({ path: prefix, sampleType, sampleValue: truncate(String(value)) });

    return out;
}

export const restJsonAdapter: DataSourceAdapter<RestDataSourceConfig> = new RestJsonAdapter();
