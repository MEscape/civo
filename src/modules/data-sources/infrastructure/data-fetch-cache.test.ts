import { vi, describe, it, expect, beforeEach } from "vitest";
import { cachedRestFetch } from "./data-fetch-cache";
import { restJsonAdapter } from "@/modules/data-sources/infrastructure/adapters/rest-json-adapter";
import type { DataSourceError } from "@/modules/data-sources/domain/data-source-adapter";
import type { RestDataSourceConfig } from "@/modules/data-sources/domain/data-source-schema";

vi.mock("next/cache", () => ({
    unstable_cacheTag: vi.fn(),
    unstable_cacheLife: vi.fn(),
}));

vi.mock("@/modules/data-sources/infrastructure/adapters/rest-json-adapter", () => ({
    restJsonAdapter: {
        fetch: vi.fn(),
    },
}));

const mockConfig: RestDataSourceConfig = { baseUrl: "https://example.com", authMode: "NONE", path: "" };

describe("cachedRestFetch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns data on success", async () => {
        vi.mocked(restJsonAdapter.fetch).mockResolvedValue({ ok: true, data: ["record"] });

        const result = await cachedRestFetch("ds-1", "Event", "v1", "ds-1", mockConfig);

        expect(result).toEqual({ ok: true, data: ["record"] });
    });

    it("returns error on failure without throwing to the caller", async () => {
        const failure: DataSourceError = {
            code: "EXTERNAL_API_ERROR",
            message: "Die Datenquelle konnte nicht erreicht werden.",
            category: "CONNECTION_FAILED",
        };
        vi.mocked(restJsonAdapter.fetch).mockResolvedValue({ ok: false, error: failure });

        const result = await cachedRestFetch("ds-1", "Event", "v1", "ds-1", mockConfig);

        expect(result).toEqual({ ok: false, error: failure });
    });
});
