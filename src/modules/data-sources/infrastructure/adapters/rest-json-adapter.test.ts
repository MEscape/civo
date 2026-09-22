import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    MAX_RESPONSE_BYTES,
    REQUEST_TIMEOUT_MS,
    RestJsonAdapter,
    flattenFields,
    restJsonAdapter,
    type RestJsonAdapterDependencies,
} from "./rest-json-adapter";
import type { RestDataSourceConfig } from "@/modules/data-sources/domain/data-source-schema";

const PUBLIC_ADDRESS = "93.184.216.34";
const CONTEXT = { dataSourceId: "ds-1" };

function jsonResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }): Response {
    return new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { "content-type": "application/json", ...init?.headers },
    });
}

const baseConfig: RestDataSourceConfig = {
    baseUrl: "https://example-municipality.de/api",
    path: "/events",
    authMode: "NONE",
};

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

/** Builds an adapter whose network, DNS and credentials are all injected. */
function createAdapter(overrides: RestJsonAdapterDependencies & { fetchMock?: FetchMock } = {}) {
    const fetchMock: FetchMock = overrides.fetchMock ?? vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([]));
    const resolveHost = overrides.resolveHost ?? vi.fn(async () => [PUBLIC_ADDRESS]);

    const adapter = new RestJsonAdapter({
        fetchImplementation: fetchMock,
        resolveHost,
        authHeaders: overrides.authHeaders ?? (() => ({ ok: true, data: {} })),
    });

    return { adapter, fetchMock, resolveHost };
}

/** A response whose body is an endless stream of `chunk`-sized pieces. */
function streamingResponse(totalBytes: number, chunkBytes = 1024 * 1024): Response {
    let sent = 0;

    const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
            if (sent >= totalBytes) {
                controller.close();
                return;
            }

            const size = Math.min(chunkBytes, totalBytes - sent);

            controller.enqueue(new Uint8Array(size).fill(0x61)); // "a"
            sent += size;
        },
    });

    // No content-length header: forces the streaming size guard to do the work.
    return new Response(stream, { status: 200 });
}

describe("RestJsonAdapter", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    describe("parseConfig", () => {
        const { adapter } = createAdapter();

        it("applies defaults for path and authMode", () => {
            expect(adapter.parseConfig({ baseUrl: "https://example.de/api" })).toEqual({
                ok: true,
                data: { baseUrl: "https://example.de/api", path: "/", authMode: "NONE" },
            });
        });

        it("rejects config with unknown keys such as a stray credential", () => {
            expect(adapter.parseConfig({ baseUrl: "https://example.de/api", apiKey: "leak" }).ok).toBe(false);
        });

        it("rejects config shaped for another kind", () => {
            expect(adapter.parseConfig({ endpoint: "https://example.de/graphql" }).ok).toBe(false);
        });

        it("rejects a missing config", () => {
            expect(adapter.parseConfig(undefined).ok).toBe(false);
        });
    });

    describe("testConnection", () => {
        it("returns statusCode and responseTimeMs on success", async () => {
            const { adapter } = createAdapter({ fetchMock: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([{ id: 1 }])) });

            const result = await adapter.testConnection(baseConfig, CONTEXT);

            expect(result.ok).toBe(true);

            if (result.ok) {
                expect(result.data.statusCode).toBe(200);
                expect(typeof result.data.responseTimeMs).toBe("number");
            }
        });

        it("still accepts the legacy bare data source id", async () => {
            const authHeaders = vi.fn(() => ({ ok: true as const, data: {} }));
            const { adapter } = createAdapter({ authHeaders });

            const result = await adapter.testConnection(baseConfig, "legacy-id");

            expect(result.ok).toBe(true);
            expect(authHeaders).toHaveBeenCalledWith("legacy-id", "NONE");
        });

        it("rejects a baseUrl pointing at a private network address without fetching (SSRF guard)", async () => {
            const { adapter, fetchMock } = createAdapter();

            const result = await adapter.testConnection({ ...baseConfig, baseUrl: "http://169.254.169.254/" }, CONTEXT);

            expect(result.ok).toBe(false);

            if (!result.ok) {
                expect(result.error.code).toBe("VALIDATION_ERROR");
                expect(result.error.category).toBe("INVALID_CONFIGURATION");
            }

            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("rejects an absolute path that smuggles in a private target", async () => {
            const { adapter, fetchMock } = createAdapter();

            const result = await adapter.testConnection(
                { ...baseConfig, path: "http://169.254.169.254/latest/meta-data/" },
                CONTEXT
            );

            expect(result.ok).toBe(false);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("maps a 401 response to an unauthorized error with an AUTHENTICATION_FAILED category", async () => {
            const { adapter } = createAdapter({ fetchMock: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, { status: 401 })) });

            const result = await adapter.testConnection(baseConfig, CONTEXT);

            expect(result.ok).toBe(false);

            if (!result.ok) {
                expect(result.error.code).toBe("UNAUTHORIZED");
                expect(result.error.category).toBe("AUTHENTICATION_FAILED");
            }
        });

        it("maps a 403 response to an unauthorized error with an AUTHENTICATION_FAILED category", async () => {
            const { adapter } = createAdapter({ fetchMock: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, { status: 403 })) });

            const result = await adapter.testConnection(baseConfig, CONTEXT);

            expect(result.ok).toBe(false);

            if (!result.ok) {
                expect(result.error.code).toBe("UNAUTHORIZED");
                expect(result.error.category).toBe("AUTHENTICATION_FAILED");
            }
        });

        it("maps a 500 response to an external API error with an INVALID_RESPONSE category", async () => {
            const { adapter } = createAdapter({ fetchMock: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, { status: 500 })) });

            const result = await adapter.testConnection(baseConfig, CONTEXT);

            expect(result.ok).toBe(false);

            if (!result.ok) {
                expect(result.error.code).toBe("EXTERNAL_API_ERROR");
                expect(result.error.category).toBe("INVALID_RESPONSE");
                expect(result.error.message).toContain("500");
            }
        });

        it("maps a network failure to an external API error with a CONNECTION_FAILED category", async () => {
            const { adapter } = createAdapter({ fetchMock: vi.fn<typeof fetch>().mockRejectedValue(new Error("ECONNREFUSED")) });

            const result = await adapter.testConnection(baseConfig, CONTEXT);

            expect(result.ok).toBe(false);

            if (!result.ok) {
                expect(result.error.code).toBe("EXTERNAL_API_ERROR");
                expect(result.error.category).toBe("CONNECTION_FAILED");
            }
        });

        it("does not leak the underlying network error message to the caller", async () => {
            const { adapter } = createAdapter({
                fetchMock: vi.fn<typeof fetch>().mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.7:5432")),
            });

            const result = await adapter.testConnection(baseConfig, CONTEXT);

            expect(JSON.stringify(result)).not.toContain("10.0.0.7");
        });

        it("maps a non-JSON response to an INVALID_RESPONSE error", async () => {
            const { adapter } = createAdapter({
                fetchMock: vi.fn<typeof fetch>().mockResolvedValue(new Response("<html>not json</html>", { status: 200 })),
            });

            const result = await adapter.testConnection(baseConfig, CONTEXT);

            expect(result.ok).toBe(false);

            if (!result.ok) {
                expect(result.error.message).toMatch(/gültiges JSON/i);
                expect(result.error.category).toBe("INVALID_RESPONSE");
            }
        });

        it("fails closed when auth is required but no credential is configured", async () => {
            const { adapter, fetchMock } = createAdapter({
                authHeaders: () => ({ ok: false, error: "API key is not configured for this data source." }),
            });

            const result = await adapter.testConnection({ ...baseConfig, authMode: "API_KEY" }, CONTEXT);

            expect(result.ok).toBe(false);

            if (!result.ok) expect(result.error.category).toBe("INVALID_CONFIGURATION");

            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("sends the resolved auth header when a credential is configured", async () => {
            const { adapter, fetchMock } = createAdapter({
                authHeaders: () => ({ ok: true, data: { Authorization: "Bearer test-token" } }),
            });

            await adapter.testConnection({ ...baseConfig, authMode: "BEARER_TOKEN" }, CONTEXT);

            const [, requestInit] = fetchMock.mock.calls[0]!;

            expect((requestInit!.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
        });

        it("asks the credential provider for the right data source and auth mode", async () => {
            const authHeaders = vi.fn(() => ({ ok: true as const, data: {} }));
            const { adapter } = createAdapter({ authHeaders });

            await adapter.testConnection({ ...baseConfig, authMode: "API_KEY" }, { dataSourceId: "ds-9" });

            expect(authHeaders).toHaveBeenCalledWith("ds-9", "API_KEY");
        });

        it("never follows redirects", async () => {
            const { adapter, fetchMock } = createAdapter();

            await adapter.testConnection(baseConfig, CONTEXT);

            const [, requestInit] = fetchMock.mock.calls[0]!;

            expect(requestInit!.redirect).toBe("error");
        });

        it("sends a GET with a JSON Accept header", async () => {
            const { adapter, fetchMock } = createAdapter();

            await adapter.testConnection(baseConfig, CONTEXT);

            const [, requestInit] = fetchMock.mock.calls[0]!;

            expect(requestInit!.method).toBe("GET");
            expect((requestInit!.headers as Record<string, string>).Accept).toBe("application/json");
        });
    });

    describe("response size limit", () => {
        it("rejects a response larger than the maximum via content-length, without reading the body", async () => {
            const { adapter } = createAdapter({
                fetchMock: vi
                    .fn<typeof fetch>()
                    .mockResolvedValue(jsonResponse([], { headers: { "content-length": String(10 * 1024 * 1024) } })),
            });

            const result = await adapter.testConnection(baseConfig, CONTEXT);

            expect(result.ok).toBe(false);

            if (!result.ok) expect(result.error.message).toMatch(/zu groß/i);
        });

        it("rejects an oversized STREAMED body that declares no content-length", async () => {
            const { adapter } = createAdapter({
                fetchMock: vi.fn<typeof fetch>().mockResolvedValue(streamingResponse(MAX_RESPONSE_BYTES + 1024)),
            });

            const result = await adapter.testConnection(baseConfig, CONTEXT);

            expect(result.ok).toBe(false);

            if (!result.ok) {
                expect(result.error.message).toMatch(/too large/i);
                expect(result.error.category).toBe("INVALID_RESPONSE");
            }
        });

        it("cancels the stream instead of buffering the rest once the limit is exceeded", async () => {
            let cancelled = false;
            let pulls = 0;

            // Bounded so that, if the size guard were ever removed, this test
            // FAILS quickly on the assertions below instead of hanging CI on
            // an endless stream.
            const HARD_STOP_PULLS = 40;

            const stream = new ReadableStream<Uint8Array>({
                pull(controller) {
                    pulls += 1;

                    if (pulls >= HARD_STOP_PULLS) {
                        controller.close();
                        return;
                    }

                    controller.enqueue(new Uint8Array(1024 * 1024));
                },
                cancel() {
                    cancelled = true;
                },
            });

            const { adapter } = createAdapter({
                fetchMock: vi.fn<typeof fetch>().mockResolvedValue(new Response(stream, { status: 200 })),
            });

            const result = await adapter.testConnection(baseConfig, CONTEXT);

            expect(result.ok).toBe(false);
            expect(cancelled).toBe(true);
            // 5 MB limit / 1 MB chunks: must stop shortly after the limit, not read forever.
            expect(pulls).toBeLessThan(20);
        });

        it("accepts a body exactly at the maximum size when it is valid JSON", async () => {
            const padding = " ".repeat(MAX_RESPONSE_BYTES - 2);
            const body = `[${padding}]`;

            expect(Buffer.byteLength(body)).toBe(MAX_RESPONSE_BYTES);

            const { adapter } = createAdapter({
                fetchMock: vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status: 200 })),
            });

            const result = await adapter.fetch(baseConfig, CONTEXT);

            expect(result).toEqual({ ok: true, data: [] });
        });
    });

    describe("timeouts", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        it("aborts a request that never answers and reports CONNECTION_FAILED", async () => {
            const fetchMock = vi.fn<typeof fetch>((_url, init) => {
                return new Promise<Response>((_resolve, reject) => {
                    init!.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
                });
            });
            const { adapter } = createAdapter({ fetchMock });

            const pending = adapter.testConnection(baseConfig, CONTEXT);

            await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 1);

            const result = await pending;

            expect(result.ok).toBe(false);

            if (!result.ok) {
                expect(result.error.category).toBe("CONNECTION_FAILED");
                expect(result.error.message).toMatch(/Zeitüberschreitung/i);
            }
        });

        it("times out a server that sends headers promptly and then stalls the body", async () => {
            // Regression: the timeout used to be cleared as soon as fetch()
            // resolved, so a body that never finished could hang forever.
            const fetchMock = vi.fn<typeof fetch>((_url, init) => {
                const stream = new ReadableStream<Uint8Array>({
                    start(controller) {
                        init!.signal!.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")));
                    },
                });

                return Promise.resolve(new Response(stream, { status: 200 }));
            });
            const { adapter } = createAdapter({ fetchMock });

            const pending = adapter.testConnection(baseConfig, CONTEXT);

            await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 1);

            const result = await pending;

            expect(result.ok).toBe(false);

            if (!result.ok) {
                expect(result.error.category).toBe("CONNECTION_FAILED");
                expect(result.error.message).toMatch(/Zeitüberschreitung/i);
            }
        });

        it("does not leave a timer running after a successful request", async () => {
            const { adapter } = createAdapter();

            await adapter.testConnection(baseConfig, CONTEXT);

            expect(vi.getTimerCount()).toBe(0);
        });

        it("does not leave a timer running after a failed request", async () => {
            const { adapter } = createAdapter({ fetchMock: vi.fn<typeof fetch>().mockRejectedValue(new Error("boom")) });

            await adapter.testConnection(baseConfig, CONTEXT);

            expect(vi.getTimerCount()).toBe(0);
        });
    });

    describe("DNS rebinding guard", () => {
        it("resolves the hostname before fetching", async () => {
            const { adapter, resolveHost } = createAdapter();

            await adapter.testConnection(baseConfig, CONTEXT);

            expect(resolveHost).toHaveBeenCalledWith("example-municipality.de");
        });

        it("refuses a public-looking hostname that resolves to a private address", async () => {
            const { adapter, fetchMock } = createAdapter({ resolveHost: async () => ["10.0.0.5"] });

            const result = await adapter.testConnection(baseConfig, CONTEXT);

            expect(result.ok).toBe(false);

            if (!result.ok) expect(result.error.category).toBe("INVALID_CONFIGURATION");

            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("refuses a hostname that resolves to the cloud metadata address", async () => {
            const { adapter, fetchMock } = createAdapter({ resolveHost: async () => ["169.254.169.254"] });

            const result = await adapter.testConnection(baseConfig, CONTEXT);

            expect(result.ok).toBe(false);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("refuses when ANY resolved address is private, even if others are public", async () => {
            const { adapter, fetchMock } = createAdapter({ resolveHost: async () => [PUBLIC_ADDRESS, "127.0.0.1"] });

            const result = await adapter.testConnection(baseConfig, CONTEXT);

            expect(result.ok).toBe(false);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("refuses a hostname that resolves to a private IPv6 address", async () => {
            const { adapter, fetchMock } = createAdapter({ resolveHost: async () => ["fd00::1"] });

            const result = await adapter.testConnection(baseConfig, CONTEXT);

            expect(result.ok).toBe(false);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("reports CONNECTION_FAILED when the hostname cannot be resolved", async () => {
            const { adapter, fetchMock } = createAdapter({
                resolveHost: async () => {
                    throw new Error("ENOTFOUND");
                },
            });

            const result = await adapter.testConnection(baseConfig, CONTEXT);

            expect(result.ok).toBe(false);

            if (!result.ok) expect(result.error.category).toBe("CONNECTION_FAILED");

            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("reports CONNECTION_FAILED when resolution returns no addresses", async () => {
            const { adapter } = createAdapter({ resolveHost: async () => [] });

            const result = await adapter.testConnection(baseConfig, CONTEXT);

            expect(result.ok).toBe(false);

            if (!result.ok) expect(result.error.category).toBe("CONNECTION_FAILED");
        });

        it("skips DNS resolution for a public IP literal, which the URL check already covers", async () => {
            const { adapter, resolveHost, fetchMock } = createAdapter();

            const result = await adapter.testConnection({ ...baseConfig, baseUrl: `http://${PUBLIC_ADDRESS}/api` }, CONTEXT);

            expect(result.ok).toBe(true);
            expect(resolveHost).not.toHaveBeenCalled();
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });

    describe("discover", () => {
        function discoverWith(body: unknown) {
            const { adapter } = createAdapter({ fetchMock: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(body)) });

            return adapter.discover(baseConfig, CONTEXT);
        }

        it("flattens a flat object response into top-level fields", async () => {
            const result = await discoverWith({ title: "Stadtfest", start: "2026-09-20T18:00:00", location: "Rathaus" });

            expect(result.ok).toBe(true);

            if (result.ok) {
                expect(result.data.fields.map((f) => f.path).sort()).toEqual(["location", "start", "title"]);
            }
        });

        it("discovers fields from the records of an array response, without an index prefix", async () => {
            const result = await discoverWith([{ event_name: "Stadtfest", venue: "Marktplatz" }]);

            expect(result.ok).toBe(true);

            if (result.ok) {
                // Mapping is defined per record (spec §9: "event_name → title").
                expect(result.data.fields.map((f) => f.path).sort()).toEqual(["event_name", "venue"]);
            }
        });

        it("discovers nested fields using dot paths", async () => {
            const result = await discoverWith({ location: { name: "Rathaus", zip: "12345" } });

            expect(result.ok).toBe(true);

            if (result.ok) {
                expect(result.data.fields.map((f) => f.path).sort()).toEqual(["location.name", "location.zip"]);
            }
        });

        it("offers the union of fields across sampled records, not just the first record's", async () => {
            const result = await discoverWith([
                { title: "A" },
                { title: "B", description: "only in the second record" },
                { title: "C", venue: "only in the third record" },
            ]);

            expect(result.ok).toBe(true);

            if (result.ok) {
                expect(result.data.fields.map((f) => f.path).sort()).toEqual(["description", "title", "venue"]);
            }
        });

        it("keeps the first sample value seen for a field that appears in several records", async () => {
            const result = await discoverWith([{ title: "First" }, { title: "Second" }]);

            expect(result.ok).toBe(true);

            if (result.ok) expect(result.data.fields).toEqual([{ path: "title", sampleType: "string", sampleValue: "First" }]);
        });

        it("limits the sample to the first five records", async () => {
            const result = await discoverWith(Array.from({ length: 20 }, (_, index) => ({ n: index })));

            expect(result.ok).toBe(true);

            if (result.ok) expect(result.data.sample).toHaveLength(5);
        });

        it("always returns the sample as a list, even for a single-object response", async () => {
            const result = await discoverWith({ title: "Stadtfest" });

            expect(result.ok).toBe(true);

            if (result.ok) expect(result.data.sample).toEqual([{ title: "Stadtfest" }]);
        });

        it("returns an empty field list and no sample for an empty array response", async () => {
            const result = await discoverWith([]);

            expect(result.ok).toBe(true);

            if (result.ok) {
                expect(result.data.fields).toEqual([]);
                expect(result.data.sample).toEqual([]);
            }
        });

        it("returns no fields for a bare JSON null", async () => {
            const result = await discoverWith(null);

            expect(result.ok).toBe(true);

            if (result.ok) {
                expect(result.data.fields).toEqual([]);
                expect(result.data.sample).toEqual([]);
            }
        });

        it("reports a nested array as a single array field instead of an index-specific path", async () => {
            const result = await discoverWith({ tags: ["a", "b", "c"], items: [{ name: "x" }] });

            expect(result.ok).toBe(true);

            if (result.ok) {
                expect(result.data.fields).toEqual([
                    { path: "tags", sampleType: "array", sampleValue: "[3 item(s)]" },
                    { path: "items", sampleType: "array", sampleValue: "[1 item(s)]" },
                ]);
            }
        });

        it("propagates a connection failure the same way testConnection does", async () => {
            const { adapter } = createAdapter({ fetchMock: vi.fn<typeof fetch>().mockRejectedValue(new Error("ECONNREFUSED")) });

            const result = await adapter.discover(baseConfig, CONTEXT);

            expect(result.ok).toBe(false);

            if (!result.ok) expect(result.error.category).toBe("CONNECTION_FAILED");
        });
    });

    describe("fetch", () => {
        it("returns the raw parsed JSON body", async () => {
            const body = [{ id: "1", title: "Stadtfest" }];
            const { adapter } = createAdapter({ fetchMock: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(body)) });

            const result = await adapter.fetch(baseConfig, CONTEXT);

            expect(result).toEqual({ ok: true, data: body });
        });

        it("propagates auth failures", async () => {
            const { adapter } = createAdapter({ fetchMock: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, { status: 401 })) });

            const result = await adapter.fetch(baseConfig, CONTEXT);

            expect(result.ok).toBe(false);
        });
    });

    describe("default instance", () => {
        it("is a RestJsonAdapter wired to the real global fetch", () => {
            expect(restJsonAdapter).toBeInstanceOf(RestJsonAdapter);
        });
    });
});

describe("flattenFields", () => {
    it("truncates long sample values", () => {
        const [field] = flattenFields({ note: "x".repeat(200) });

        expect(field!.sampleValue).toHaveLength(81);
        expect(field!.sampleValue.endsWith("…")).toBe(true);
    });

    it("stops descending at the maximum depth and reports an object", () => {
        const fields = flattenFields({ a: { b: { c: { d: { e: "deep" } } } } });

        expect(fields).toEqual([{ path: "a.b.c.d", sampleType: "object", sampleValue: "{…}" }]);
    });

    it("caps the number of discovered fields", () => {
        const wide = Object.fromEntries(Array.from({ length: 500 }, (_, index) => [`f${index}`, index]));

        expect(flattenFields(wide)).toHaveLength(200);
    });

    it("types primitives and nulls", () => {
        const fields = flattenFields({ n: 1, b: true, s: "text", z: null });

        expect(fields).toEqual([
            { path: "n", sampleType: "number", sampleValue: "1" },
            { path: "b", sampleType: "boolean", sampleValue: "true" },
            { path: "s", sampleType: "string", sampleValue: "text" },
            { path: "z", sampleType: "null", sampleValue: "null" },
        ]);
    });

    it("produces no fields for a bare primitive root, which has no name to map from", () => {
        expect(flattenFields("just a string")).toEqual([]);
        expect(flattenFields(42)).toEqual([]);
    });
});
