import { beforeEach, describe, expect, it, vi } from "vitest";
import { RestCivicDataProvider } from "./rest-civic-provider";
import { restJsonAdapter } from "@/modules/data-sources/infrastructure/adapters/rest-json-adapter";
import type { DataSourceView } from "@/modules/data-sources/domain/data-source-schema";

vi.mock("@/modules/data-sources/infrastructure/adapters/rest-json-adapter", () => ({
    restJsonAdapter: {
        fetch: vi.fn(),
        testConnection: vi.fn(),
        discover: vi.fn(),
    },
}));

// unstable_cache requires Next's request-time incremental cache, which
// doesn't exist in a plain Vitest unit test. Pass the wrapped function
// through uncached — data-fetch-cache.test.ts covers the caching
// behavior itself in isolation; this test suite only needs
// RestCivicDataProvider's mapping/fallback logic, which is orthogonal to
// whether the underlying fetch happens to be cached.
vi.mock("next/cache", () => ({
    unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
    unstable_cacheTag: vi.fn(),
    unstable_cacheLife: vi.fn(),
}));

import type { DatasetView } from "@/modules/data-sources/domain/dataset-schema";

function makeDataset(overrides: Partial<DatasetView> = {}): DatasetView {
    return {
        id: "ds-1",
        dataSourceId: "ds-1",
        name: "Events",
        slug: "events",
        canonicalType: "Event",
        sourceName: "test",
        sourceKind: "REST",
        sourceStatus: "OK",
        mapping: {
            fields: [
                { sourcePath: "event_name", targetPath: "title", required: true },
                { sourcePath: "start", targetPath: "startDate", transform: { kind: "date" }, required: true },
            ],
        },
        status: "OK",
        lastFetchedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    } as DatasetView;
}

function makeSource(overrides: Partial<DataSourceView> = {}): DataSourceView {
    return {
        id: "ds-1",
        websiteId: "website-1",
        name: "Municipal Events",
        kind: "REST",
        dataset: "civic",
        config: { baseUrl: "https://example.de/api", path: "/events", authMode: "NONE" },
        mapping: {
            fields: [
                { sourcePath: "event_name", targetPath: "title", required: true },
                { sourcePath: "start", targetPath: "startDate", transform: { kind: "date" }, required: true },
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

describe("RestCivicDataProvider", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getEvents", () => {
        it("maps and validates real external records into canonical events", async () => {
            vi.mocked(restJsonAdapter.fetch).mockResolvedValue({
                ok: true,
                data: [
                    { id: "evt-1", event_name: "Stadtfest", start: "2026-09-20T18:00:00" },
                    { id: "evt-2", event_name: "Weihnachtsmarkt", start: "2026-12-01T10:00:00" },
                ],
            });

            const provider = new RestCivicDataProvider(makeSource(), makeDataset());
            const result = await provider.getEvents();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.data).toHaveLength(2);
                expect(result.data[0]).toMatchObject({ id: "evt-1", title: "Stadtfest" });
                expect(result.data[0].startDate).toBeInstanceOf(Date);
            }
        });

        it("derives a stable id from the raw record when mapping doesn't include one", async () => {
            vi.mocked(restJsonAdapter.fetch).mockResolvedValue({
                ok: true,
                data: [{ uuid: "external-uuid-1", event_name: "Stadtfest", start: "2026-09-20T18:00:00" }],
            });

            const provider = new RestCivicDataProvider(makeSource(), makeDataset());
            const result = await provider.getEvents();

            expect(result.ok).toBe(true);
            if (result.ok) expect(result.data[0].id).toBe("external-uuid-1");
        });

        it("falls back to a content hash id when no id-like field exists on the raw record", async () => {
            vi.mocked(restJsonAdapter.fetch).mockResolvedValue({
                ok: true,
                data: [{ event_name: "Stadtfest", start: "2026-09-20T18:00:00" }],
            });

            const provider = new RestCivicDataProvider(makeSource(), makeDataset());
            const result = await provider.getEvents();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.data[0].id).toMatch(/^[a-f0-9]{16}$/);
            }
        });

        it("skips a record that fails required-field mapping without failing the whole batch", async () => {
            vi.mocked(restJsonAdapter.fetch).mockResolvedValue({
                ok: true,
                data: [
                    { event_name: "Stadtfest", start: "2026-09-20T18:00:00" },
                    { start: "2026-12-01T10:00:00" }, // missing event_name (required)
                ],
            });

            const provider = new RestCivicDataProvider(makeSource(), makeDataset());
            const result = await provider.getEvents();

            expect(result.ok).toBe(true);
            if (result.ok) expect(result.data).toHaveLength(1);
        });

        it("skips a record whose mapped value fails canonical schema validation", async () => {
            vi.mocked(restJsonAdapter.fetch).mockResolvedValue({
                ok: true,
                data: [{ event_name: "Stadtfest", start: "not-a-valid-date" }],
            });

            const provider = new RestCivicDataProvider(makeSource(), makeDataset());
            const result = await provider.getEvents();

            expect(result.ok).toBe(true);
            if (result.ok) expect(result.data).toHaveLength(0);
        });

        it("applies limit and category filters after mapping", async () => {
            vi.mocked(restJsonAdapter.fetch).mockResolvedValue({
                ok: true,
                data: [
                    { id: "1", event_name: "A", start: "2026-09-20T18:00:00" },
                    { id: "2", event_name: "B", start: "2026-09-21T18:00:00" },
                ],
            });

            const provider = new RestCivicDataProvider(makeSource(), makeDataset());
            const result = await provider.getEvents({ limit: 1 });

            expect(result.ok).toBe(true);
            if (result.ok) expect(result.data).toHaveLength(1);
        });

        it("falls back to mock data when no mapping is configured", async () => {
            const provider = new RestCivicDataProvider(makeSource(), makeDataset({  mapping: null  }));

            const result = await provider.getEvents();

            expect(result.ok).toBe(true);
            expect(restJsonAdapter.fetch).not.toHaveBeenCalled();
        });

        it("falls back to mock data when the adapter fetch fails", async () => {
            vi.mocked(restJsonAdapter.fetch).mockResolvedValue({
                ok: false,
                error: { code: "EXTERNAL_API_ERROR", message: "unreachable", category: "CONNECTION_FAILED" },
            });

            const provider = new RestCivicDataProvider(makeSource(), makeDataset());
            const result = await provider.getEvents();

            // Falls back to MockCivicDataProvider's own (non-empty) sample data.
            expect(result.ok).toBe(true);
            if (result.ok) expect(result.data.length).toBeGreaterThan(0);
        });

        it("falls back to mock data when the saved config no longer validates", async () => {
            const provider = new RestCivicDataProvider(makeSource({  config: { notAValidRestConfig: true }  }), makeDataset());

            const result = await provider.getEvents();

            expect(result.ok).toBe(true);
            expect(restJsonAdapter.fetch).not.toHaveBeenCalled();
        });
    });

    describe("delegation to the mock provider", () => {
        it("delegates getNews, getServices, getContacts, and other unmapped methods", async () => {
            const provider = new RestCivicDataProvider(makeSource(), makeDataset());

            const [news, services, contacts, openingHours, serviceDetails, councilBodies, waste, alerts, departments] =
                await Promise.all([
                    provider.getNews(),
                    provider.getServices(),
                    provider.getContacts(),
                    provider.getOpeningHours(),
                    provider.getServiceDetails(),
                    provider.getCouncilBodies(),
                    provider.getWasteCollectionEntries(),
                    provider.getAlerts(),
                    provider.getDepartments(),
                ]);

            for (const result of [news, services, contacts, openingHours, serviceDetails, councilBodies, waste, alerts, departments]) {
                expect(result.ok).toBe(true);
            }
        });

        it("delegates getNewsBySlug", async () => {
            const provider = new RestCivicDataProvider(makeSource(), makeDataset());
            const result = await provider.getNewsBySlug("some-slug");
            expect(result.ok).toBe(true);
        });
    });
});
