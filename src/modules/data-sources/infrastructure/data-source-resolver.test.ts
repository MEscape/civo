import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveDataSourceKind } from "./data-source-resolver";
import { dataSourceRepository } from "./data-source-repository";
import { logger } from "@/lib/logger/logger";

vi.mock("./data-source-repository", () => ({
    dataSourceRepository: {
        findByWebsiteAndDataset: vi.fn(),
    },
}));

vi.mock("@/lib/logger/logger", () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

describe("resolveDataSourceKind", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("resolves to MOCK with no row when websiteId is undefined", async () => {
        const result = await resolveDataSourceKind(undefined, "civic");
        expect(result).toEqual({ kind: "MOCK", row: null });
        expect(dataSourceRepository.findByWebsiteAndDataset).not.toHaveBeenCalled();
    });

    it("resolves to MOCK and logs when the repository lookup fails", async () => {
        vi.mocked(dataSourceRepository.findByWebsiteAndDataset).mockResolvedValue({
            ok: false,
            error: { code: "DATABASE_ERROR", message: "failed" },
        });

        const result = await resolveDataSourceKind("website-1", "civic");

        expect(result).toEqual({ kind: "MOCK", row: null });
        expect(logger.error).toHaveBeenCalled();
    });

    it("resolves to MOCK when no row is configured for the dataset", async () => {
        vi.mocked(dataSourceRepository.findByWebsiteAndDataset).mockResolvedValue({ ok: true, data: null });

        const result = await resolveDataSourceKind("website-1", "civic");

        expect(result).toEqual({ kind: "MOCK", row: null });
    });

    it("resolves to MOCK when the configured row's kind is MOCK", async () => {
        const row = { id: "ds-1", kind: "MOCK" };
        vi.mocked(dataSourceRepository.findByWebsiteAndDataset).mockResolvedValue({ ok: true, data: row as never });

        const result = await resolveDataSourceKind("website-1", "civic");

        expect(result).toEqual({ kind: "MOCK", row });
    });

    it("resolves to REST and returns the row when the configured kind is REST", async () => {
        const row = { id: "ds-1", kind: "REST" };
        vi.mocked(dataSourceRepository.findByWebsiteAndDataset).mockResolvedValue({ ok: true, data: row as never });

        const result = await resolveDataSourceKind("website-1", "civic");

        expect(result).toEqual({ kind: "REST", row });
    });

    it("falls back to MOCK and logs when the configured kind is GRAPHQL (no adapter yet)", async () => {
        const row = { id: "ds-1", kind: "GRAPHQL" };
        vi.mocked(dataSourceRepository.findByWebsiteAndDataset).mockResolvedValue({ ok: true, data: row as never });

        const result = await resolveDataSourceKind("website-1", "smartcity");

        expect(result).toEqual({ kind: "MOCK", row });
        expect(logger.warn).toHaveBeenCalled();
    });
});
