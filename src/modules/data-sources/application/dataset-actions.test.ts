import { describe, expect, it, vi, beforeEach } from "vitest";
import {
    listDataSourceDatasetsAction,
    listCompatibleDatasetsAction,
    createDatasetAction,
    updateDatasetAction,
    deleteDatasetAction
} from "./dataset-actions";
import { datasetService } from "./dataset-service";

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}));

vi.mock("./dataset-service", () => {
    return {
        datasetService: {
            listForDataSource: vi.fn(),
            listCompatible: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        }
    };
});

describe("Dataset Actions", () => {
    const websiteId = "website-1";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("listDataSourceDatasetsAction returns success result", async () => {
        vi.mocked(datasetService.listForDataSource).mockResolvedValue({ ok: true, data: [{ id: "d1" } as any] });
        const result = await listDataSourceDatasetsAction("source-1", websiteId);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.data).toHaveLength(1);
    });

    it("listCompatibleDatasetsAction returns success result", async () => {
        vi.mocked(datasetService.listCompatible).mockResolvedValue({ ok: true, data: [{ id: "d2" } as any] });
        const result = await listCompatibleDatasetsAction(websiteId, "Event");
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.data).toHaveLength(1);
    });

    it("createDatasetAction delegates to service", async () => {
        vi.mocked(datasetService.create).mockResolvedValue({ ok: true, data: { id: "d3" } } as any);
        const result = await createDatasetAction({ dataSourceId: "s1", name: "Events", slug: "events", canonicalType: "Event" }, websiteId);
        expect(result.ok).toBe(true);
    });

    it("updateDatasetAction delegates to service", async () => {
        vi.mocked(datasetService.update).mockResolvedValue({ ok: true, data: { id: "d1" } } as any);
        const result = await updateDatasetAction("d1", { name: "Updated" }, websiteId);
        expect(result.ok).toBe(true);
    });

    it("deleteDatasetAction delegates to service", async () => {
        vi.mocked(datasetService.delete).mockResolvedValue({ ok: true, data: undefined });
        const result = await deleteDatasetAction("d1", websiteId);
        expect(result.ok).toBe(true);
    });
});
