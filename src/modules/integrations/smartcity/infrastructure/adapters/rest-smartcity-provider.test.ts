import { beforeEach, describe, expect, it, vi } from "vitest";
import { RestSmartCityDataProvider } from "./rest-smartcity-provider";
import { restJsonAdapter } from "@/modules/data-sources/infrastructure/adapters/rest-json-adapter";
import type { DataSourceView } from "@/modules/data-sources/domain/data-source-schema";

vi.mock("@/modules/data-sources/infrastructure/adapters/rest-json-adapter", () => ({
    restJsonAdapter: {
        fetch: vi.fn(),
        testConnection: vi.fn(),
        discover: vi.fn(),
    },
}));

// See rest-civic-provider.test.ts for why unstable_cache is mocked as a
// pass-through here.
vi.mock("next/cache", () => ({
    unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

function makeSource(overrides: Partial<DataSourceView> = {}): DataSourceView {
    return {
        id: "ds-2",
        websiteId: "website-1",
        name: "Smart Parking",
        kind: "REST",
        dataset: "smartcity",
        config: { baseUrl: "https://example.de/api", path: "/parking", authMode: "NONE" },
        mapping: {
            fields: [
                { sourcePath: "name", targetPath: "label", required: true },
                { sourcePath: "free_spaces", targetPath: "value", transform: { kind: "number" }, required: true },
            ],
        },
        status: "OK",
        lastCheckedAt: new Date(),
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    } as DataSourceView;
}

describe("RestSmartCityDataProvider", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getMetrics", () => {
        it("maps and validates real external records into canonical metrics", async () => {
            vi.mocked(restJsonAdapter.fetch).mockResolvedValue({
                ok: true,
                data: [
                    { id: "lot-1", name: "Marktplatz", free_spaces: 12 },
                    { id: "lot-2", name: "Rathaus", free_spaces: 4 },
                ],
            });

            const provider = new RestSmartCityDataProvider(makeSource());
            const result = await provider.getMetrics();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.data).toHaveLength(2);
                expect(result.data[0]).toMatchObject({ id: "lot-1", label: "Marktplatz", value: 12 });
            }
        });

        it("skips a record whose mapped value fails canonical schema validation", async () => {
            vi.mocked(restJsonAdapter.fetch).mockResolvedValue({
                ok: true,
                data: [{ name: "Marktplatz", free_spaces: "not-a-number" }],
            });

            const provider = new RestSmartCityDataProvider(makeSource());
            const result = await provider.getMetrics();

            expect(result.ok).toBe(true);
            if (result.ok) expect(result.data).toHaveLength(0);
        });

        it("filters by category after mapping", async () => {
            vi.mocked(restJsonAdapter.fetch).mockResolvedValue({
                ok: true,
                data: [{ id: "lot-1", name: "Marktplatz", free_spaces: 12 }],
            });

            const provider = new RestSmartCityDataProvider(
                makeSource({
                    mapping: {
                        fields: [
                            { sourcePath: "name", targetPath: "label", required: true },
                            { sourcePath: "free_spaces", targetPath: "value", transform: { kind: "number" }, required: true },
                            { sourcePath: "cat", targetPath: "category", transform: { kind: "fallback", value: "mobility" } },
                        ],
                    },
                })
            );
            const result = await provider.getMetrics({ category: "mobility" });

            expect(result.ok).toBe(true);
            if (result.ok) expect(result.data).toHaveLength(1);
        });

        it("falls back to mock data when no mapping is configured", async () => {
            const provider = new RestSmartCityDataProvider(makeSource({ mapping: null }));

            const result = await provider.getMetrics();

            expect(result.ok).toBe(true);
            expect(restJsonAdapter.fetch).not.toHaveBeenCalled();
        });

        it("falls back to mock data when the adapter fetch fails", async () => {
            vi.mocked(restJsonAdapter.fetch).mockResolvedValue({
                ok: false,
                error: { code: "EXTERNAL_API_ERROR", message: "unreachable", category: "CONNECTION_FAILED" },
            });

            const provider = new RestSmartCityDataProvider(makeSource());
            const result = await provider.getMetrics();

            expect(result.ok).toBe(true);
            if (result.ok) expect(result.data.length).toBeGreaterThan(0);
        });
    });
});
