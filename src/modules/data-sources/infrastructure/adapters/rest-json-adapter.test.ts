import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { restJsonAdapter } from "./rest-json-adapter";
import type { RestDataSourceConfig } from "@/modules/data-sources/domain/data-source-schema";
import * as credentials from "@/modules/data-sources/infrastructure/credentials";

function jsonResponse(
    body: unknown,
    init?: {
        status?: number;
        headers?: Record<string, string>;
    }
): Response {
    const text = JSON.stringify(body);

    return new Response(text, {
        status: init?.status ?? 200,
        headers: {
            "content-type": "application/json",
            ...init?.headers,
        },
    });
}

const baseConfig: RestDataSourceConfig = {
    baseUrl: "https://example-municipality.de/api",
    path: "/events",
    authMode: "NONE",
};

describe("restJsonAdapter", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe("testConnection", () => {
        it("returns statusCode and responseTimeMs on success", async () => {
            vi.stubGlobal(
                "fetch",
                vi.fn().mockResolvedValue(
                    jsonResponse([{ id: 1 }])
                )
            );

            const result = await restJsonAdapter.testConnection(
                baseConfig,
                "ds-1"
            );

            expect(result.ok).toBe(true);

            if (result.ok) {
                expect(result.data.statusCode).toBe(200);
                expect(typeof result.data.responseTimeMs).toBe("number");
            }
        });

        it("rejects a baseUrl pointing at a private network address (SSRF guard)", async () => {
            const fetchMock = vi.fn();

            vi.stubGlobal("fetch", fetchMock);

            const result = await restJsonAdapter.testConnection(
                {
                    ...baseConfig,
                    baseUrl: "http://169.254.169.254/",
                },
                "ds-1"
            );

            expect(result.ok).toBe(false);

            if (!result.ok) {
                expect(result.error.code).toBe("VALIDATION_ERROR");
                expect(result.error.category).toBe(
                    "INVALID_CONFIGURATION"
                );
            }

            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("maps a 401 response to an unauthorized error with an AUTHENTICATION_FAILED category", async () => {
            vi.stubGlobal(
                "fetch",
                vi.fn().mockResolvedValue(
                    jsonResponse({}, { status: 401 })
                )
            );

            const result = await restJsonAdapter.testConnection(
                baseConfig,
                "ds-1"
            );

            expect(result.ok).toBe(false);

            if (!result.ok) {
                expect(result.error.code).toBe("UNAUTHORIZED");
                expect(result.error.category).toBe(
                    "AUTHENTICATION_FAILED"
                );
            }
        });

        it("maps a 403 response to an unauthorized error with an AUTHENTICATION_FAILED category", async () => {
            vi.stubGlobal(
                "fetch",
                vi.fn().mockResolvedValue(
                    jsonResponse({}, { status: 403 })
                )
            );

            const result = await restJsonAdapter.testConnection(
                baseConfig,
                "ds-1"
            );

            expect(result.ok).toBe(false);

            if (!result.ok) {
                expect(result.error.code).toBe("UNAUTHORIZED");
                expect(result.error.category).toBe(
                    "AUTHENTICATION_FAILED"
                );
            }
        });

        it("maps a 500 response to an external API error with an INVALID_RESPONSE category", async () => {
            vi.stubGlobal(
                "fetch",
                vi.fn().mockResolvedValue(
                    jsonResponse({}, { status: 500 })
                )
            );

            const result = await restJsonAdapter.testConnection(
                baseConfig,
                "ds-1"
            );

            expect(result.ok).toBe(false);

            if (!result.ok) {
                expect(result.error.code).toBe("EXTERNAL_API_ERROR");
                expect(result.error.category).toBe(
                    "INVALID_RESPONSE"
                );
            }
        });

        it("maps a network failure to an external API error with a CONNECTION_FAILED category", async () => {
            vi.stubGlobal(
                "fetch",
                vi.fn().mockRejectedValue(
                    new Error("ECONNREFUSED")
                )
            );

            const result = await restJsonAdapter.testConnection(
                baseConfig,
                "ds-1"
            );

            expect(result.ok).toBe(false);

            if (!result.ok) {
                expect(result.error.code).toBe("EXTERNAL_API_ERROR");
                expect(result.error.category).toBe(
                    "CONNECTION_FAILED"
                );
            }
        });

        it("maps a non-JSON response to an external API error with an INVALID_RESPONSE category", async () => {
            vi.stubGlobal(
                "fetch",
                vi.fn().mockResolvedValue(
                    new Response("<html>not json</html>", {
                        status: 200,
                    })
                )
            );

            const result = await restJsonAdapter.testConnection(
                baseConfig,
                "ds-1"
            );

            expect(result.ok).toBe(false);

            if (!result.ok) {
                expect(result.error.message).toMatch(/valid JSON/i);
                expect(result.error.category).toBe(
                    "INVALID_RESPONSE"
                );
            }
        });

        it("fails closed when auth is required but no credential is configured", async () => {
            const fetchMock = vi.fn();

            vi.stubGlobal("fetch", fetchMock);

            vi.spyOn(
                credentials,
                "buildAuthHeaders"
            ).mockReturnValue({
                ok: false,
                error: "API key is not configured for this data source.",
            });

            const result = await restJsonAdapter.testConnection(
                {
                    ...baseConfig,
                    authMode: "API_KEY",
                },
                "ds-1"
            );

            expect(result.ok).toBe(false);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("sends the resolved auth header when a credential is configured", async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValue(jsonResponse([]));

            vi.stubGlobal("fetch", fetchMock);

            vi.spyOn(
                credentials,
                "buildAuthHeaders"
            ).mockReturnValue({
                ok: true,
                data: {
                    Authorization: "Bearer test-token",
                },
            });

            await restJsonAdapter.testConnection(
                {
                    ...baseConfig,
                    authMode: "BEARER_TOKEN",
                },
                "ds-1"
            );

            const [, requestInit] = fetchMock.mock.calls[0];

            expect(
                requestInit.headers.Authorization
            ).toBe("Bearer test-token");
        });

        it("rejects a response larger than the configured maximum via content-length", async () => {
            vi.stubGlobal(
                "fetch",
                vi.fn().mockResolvedValue(
                    jsonResponse([], {
                        headers: {
                            "content-length": String(
                                10 * 1024 * 1024
                            ),
                        },
                    })
                )
            );

            const result = await restJsonAdapter.testConnection(
                baseConfig,
                "ds-1"
            );

            expect(result.ok).toBe(false);

            if (!result.ok) {
                expect(result.error.message).toMatch(/too large/i);
            }
        });

        it("never follows redirects", async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValue(jsonResponse([]));

            vi.stubGlobal("fetch", fetchMock);

            await restJsonAdapter.testConnection(
                baseConfig,
                "ds-1"
            );

            const [, requestInit] = fetchMock.mock.calls[0];

            expect(requestInit.redirect).toBe("error");
        });
    });

    describe("discover", () => {
        it("flattens a flat object response into top-level fields", async () => {
            vi.stubGlobal(
                "fetch",
                vi.fn().mockResolvedValue(
                    jsonResponse({
                        title: "Stadtfest",
                        start: "2026-09-20T18:00:00",
                        location: "Rathaus",
                    })
                )
            );

            const result = await restJsonAdapter.discover(
                baseConfig,
                "ds-1"
            );

            expect(result.ok).toBe(true);

            if (result.ok) {
                const paths = result.data.fields
                    .map((f) => f.path)
                    .sort();

                expect(paths).toEqual([
                    "location",
                    "start",
                    "title",
                ]);
            }
        });

        it("discovers fields from the first item when the response is an array, without an index prefix", async () => {
            vi.stubGlobal(
                "fetch",
                vi.fn().mockResolvedValue(
                    jsonResponse([
                        {
                            event_name: "Stadtfest",
                            venue: "Marktplatz",
                        },
                    ])
                )
            );

            const result = await restJsonAdapter.discover(
                baseConfig,
                "ds-1"
            );

            expect(result.ok).toBe(true);

            if (result.ok) {
                const paths = result.data.fields
                    .map((f) => f.path)
                    .sort();

                // Mapping is defined per-record (spec §9:
                // "event_name → title"), so discovery describes
                // one item's shape, not an indexed path.
                expect(paths).toEqual([
                    "event_name",
                    "venue",
                ]);
            }
        });

        it("discovers nested fields using dot paths", async () => {
            vi.stubGlobal(
                "fetch",
                vi.fn().mockResolvedValue(
                    jsonResponse({
                        location: {
                            name: "Rathaus",
                            zip: "12345",
                        },
                    })
                )
            );

            const result = await restJsonAdapter.discover(
                baseConfig,
                "ds-1"
            );

            expect(result.ok).toBe(true);

            if (result.ok) {
                const paths = result.data.fields
                    .map((f) => f.path)
                    .sort();

                expect(paths).toEqual([
                    "location.name",
                    "location.zip",
                ]);
            }
        });

        it("returns an empty field list for an empty array response", async () => {
            vi.stubGlobal(
                "fetch",
                vi.fn().mockResolvedValue(
                    jsonResponse([])
                )
            );

            const result = await restJsonAdapter.discover(
                baseConfig,
                "ds-1"
            );

            expect(result.ok).toBe(true);

            if (result.ok) {
                expect(result.data.fields).toEqual([]);
            }
        });

        it("propagates a connection failure the same way testConnection does", async () => {
            vi.stubGlobal(
                "fetch",
                vi.fn().mockRejectedValue(
                    new Error("ECONNREFUSED")
                )
            );

            const result = await restJsonAdapter.discover(
                baseConfig,
                "ds-1"
            );

            expect(result.ok).toBe(false);
        });
    });

    describe("fetch", () => {
        it("returns the raw parsed JSON body", async () => {
            const body = [
                {
                    id: "1",
                    title: "Stadtfest",
                },
            ];

            vi.stubGlobal(
                "fetch",
                vi.fn().mockResolvedValue(
                    jsonResponse(body)
                )
            );

            const result = await restJsonAdapter.fetch(
                baseConfig,
                "ds-1"
            );

            expect(result).toEqual({
                ok: true,
                data: body,
            });
        });
    });
});
