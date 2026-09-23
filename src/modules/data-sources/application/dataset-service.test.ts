import { describe, expect, it, vi, beforeEach } from "vitest";
import { datasetService } from "./dataset-service";
import { datasetRepository } from "../infrastructure/dataset-repository";
import { dataSourceRepository } from "../infrastructure/data-source-repository";

vi.mock("../infrastructure/dataset-repository", () => ({
    datasetRepository: {
        findCompatible: vi.fn(),
        findByDataSource: vi.fn(),
        findByWebsite: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteManyBySource: vi.fn(),
        findByIdForWebsite: vi.fn(),
    },
}));

vi.mock("../infrastructure/data-source-repository", () => ({
    dataSourceRepository: {
        findByIdForWebsite: vi.fn(),
        findById: vi.fn(),
    },
}));

describe("DatasetService", () => {
    const websiteId = "website-1";
    const sourceId = "source-1";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("listCompatible returns datasets filtered by canonical type", async () => {
        const mockDatasets = [
            { id: "d1", name: "Events", canonicalType: "Event" },
        ];
        vi.mocked(datasetRepository.findCompatible).mockResolvedValue(mockDatasets as any);

        const result = await datasetService.listCompatible(websiteId, "Event");
        expect(datasetRepository.findCompatible).toHaveBeenCalledWith(websiteId, "Event");
        expect(result).toEqual(mockDatasets);
    });

    it("listForDataSource returns datasets for a specific source", async () => {
        const mockDatasets = [
            { id: "d1", name: "Events", canonicalType: "Event", dataSourceId: sourceId },
            { id: "d2", name: "News", canonicalType: "NewsItem", dataSourceId: sourceId },
        ];
        vi.mocked(dataSourceRepository.findByIdForWebsite).mockResolvedValue({ ok: true, data: { id: sourceId } } as any);
        vi.mocked(datasetRepository.findByDataSource).mockResolvedValue(mockDatasets as any);

        const result = await datasetService.listForDataSource(sourceId, websiteId);
        expect(dataSourceRepository.findByIdForWebsite).toHaveBeenCalledWith(sourceId, websiteId);
        expect(datasetRepository.findByDataSource).toHaveBeenCalledWith(sourceId);
        expect(result).toEqual(mockDatasets);
    });

    it("create delegates to repository", async () => {
        const input = {
            dataSourceId: sourceId,
            name: "New Data",
            slug: "new-data",
            canonicalType: "Event" as const,
        };
        const created = { id: "d3", ...input };
        vi.mocked(dataSourceRepository.findByIdForWebsite).mockResolvedValue({ ok: true, data: { id: sourceId } } as any);
        vi.mocked(datasetRepository.create).mockResolvedValue({ ok: true, data: created } as any);

        const result = await datasetService.create(input, websiteId);
        expect(datasetRepository.create).toHaveBeenCalledWith(input);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.data).toEqual(created);
    });

    it("delete delegates to repository", async () => {
        vi.mocked(datasetRepository.findByIdForWebsite).mockResolvedValue({ ok: true, data: { id: "d1" } } as any);
        vi.mocked(datasetRepository.delete).mockResolvedValue({ ok: true, data: undefined } as any);

        const result = await datasetService.delete("d1", websiteId);
        expect(datasetRepository.delete).toHaveBeenCalledWith("d1");
        expect(result.ok).toBe(true);
    });
});
