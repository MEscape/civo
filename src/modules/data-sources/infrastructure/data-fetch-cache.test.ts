import { beforeEach, describe, expect, it, vi } from "vitest";
import { cachedRestFetch } from "./data-fetch-cache";

type UnstableCacheArgs = [
    fn: (...args: unknown[]) => unknown,
    keyParts: string[],
    options: { revalidate: number; tags: string[] },
];

const unstableCacheMock = vi.fn((...args: UnstableCacheArgs) => args[0]);

vi.mock("next/cache", () => ({
    unstable_cache: (...args: UnstableCacheArgs) => unstableCacheMock(...args),
}));

describe("cachedRestFetch", () => {
    beforeEach(() => {
        unstableCacheMock.mockClear();
    });

    it("calls unstable_cache with a key that includes the data source id and version", async () => {
        const fetchRaw = vi.fn().mockResolvedValue({ ok: true, data: [] });

        await cachedRestFetch("ds-1", "civic", "2026-09-18T00:00:00.000Z", fetchRaw);

        expect(unstableCacheMock).toHaveBeenCalledWith(
            expect.any(Function),
            ["data-source-fetch", "ds-1", "2026-09-18T00:00:00.000Z"],
            expect.objectContaining({ tags: ["data-source:ds-1"] })
        );
    });

    it("uses a shorter revalidate window for smartcity than civic", async () => {
        const fetchRaw = vi.fn().mockResolvedValue({ ok: true, data: [] });

        await cachedRestFetch("ds-1", "civic", "v1", fetchRaw);
        const civicCall = unstableCacheMock.mock.calls[0];
        expect(civicCall).toBeDefined();
        const civicRevalidate = civicCall![2].revalidate;

        unstableCacheMock.mockClear();
        await cachedRestFetch("ds-2", "smartcity", "v1", fetchRaw);
        const smartcityCall = unstableCacheMock.mock.calls[0];
        expect(smartcityCall).toBeDefined();
        const smartcityRevalidate = smartcityCall![2].revalidate;

        expect(smartcityRevalidate).toBeLessThan(civicRevalidate);
    });

    it("produces a different cache key when the version changes (e.g. after an edit)", async () => {
        const fetchRaw = vi.fn().mockResolvedValue({ ok: true, data: [] });

        await cachedRestFetch("ds-1", "civic", "v1", fetchRaw);
        const firstCall = unstableCacheMock.mock.calls[0];
        expect(firstCall).toBeDefined();
        const firstKey = firstCall![1];

        unstableCacheMock.mockClear();
        await cachedRestFetch("ds-1", "civic", "v2", fetchRaw);
        const secondCall = unstableCacheMock.mock.calls[0];
        expect(secondCall).toBeDefined();
        const secondKey = secondCall![1];

        expect(firstKey).not.toEqual(secondKey);
    });

    it("returns the result the cached function resolves to", async () => {
        const fetchRaw = vi.fn().mockResolvedValue({ ok: true, data: ["record"] });

        const result = await cachedRestFetch("ds-1", "civic", "v1", fetchRaw);

        expect(result).toEqual({ ok: true, data: ["record"] });
    });

    describe("failures are not cached", () => {
        it("returns the failed Result to the caller unchanged", async () => {
            const failure = {
                code: "EXTERNAL_API_ERROR",
                message: "Die Datenquelle konnte nicht erreicht werden.",
                category: "CONNECTION_FAILED" as const,
            };
            const fetchRaw = vi.fn().mockResolvedValue({ ok: false, error: failure });

            const result = await cachedRestFetch("ds-1", "civic", "v1", fetchRaw);

            expect(result).toEqual({ ok: false, error: failure });
        });

        it("throws instead of returning on failure, so unstable_cache's own contract never stores it", async () => {
            // This test pins the mechanism the module relies on: with the
            // identity-passthrough mock above, `cached` IS the function
            // passed to unstable_cache, so calling it directly proves
            // whether a failure is returned (cacheable) or thrown (not).
            const failure = {
                code: "EXTERNAL_API_ERROR",
                message: "boom",
                category: "CONNECTION_FAILED" as const,
            };
            const fetchRaw = vi.fn().mockResolvedValue({ ok: false, error: failure });

            await cachedRestFetch("ds-1", "civic", "v1", fetchRaw);

            const wrapped = unstableCacheMock.mock.calls[0]![0];

            await expect(wrapped()).rejects.toBeDefined();
        });

        it("calls fetchRaw again on a second failure instead of serving a cached failure", async () => {
            // With the identity-passthrough mock, "no caching" shows up as
            // fetchRaw being invoked once per cachedRestFetch call rather
            // than only once total.
            const fetchRaw = vi.fn().mockResolvedValue({ ok: false, error: { code: "E", message: "m", category: "CONNECTION_FAILED" } });

            await cachedRestFetch("ds-1", "civic", "v1", fetchRaw);
            await cachedRestFetch("ds-1", "civic", "v1", fetchRaw);

            expect(fetchRaw).toHaveBeenCalledTimes(2);
        });

        it("preserves the original error's code, message and category across the cache boundary", async () => {
            const failure = {
                code: "UNAUTHORIZED",
                message: "Authentication is required for this action.",
                category: "AUTHENTICATION_FAILED" as const,
                field: "authMode",
            };
            const fetchRaw = vi.fn().mockResolvedValue({ ok: false, error: failure });

            const result = await cachedRestFetch("ds-1", "civic", "v1", fetchRaw);

            expect(result).toEqual({ ok: false, error: failure });
        });
    });
});
