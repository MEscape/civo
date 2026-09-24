import { describe, expect, it, vi, beforeEach } from "vitest";
import {
    listDataSourcesAction,
    createDataSourceAction,
    deleteDataSourceAction,
    discoverDataSourceAction
} from "./data-source-actions";
import { dataSourceService } from "./data-source-service";

vi.mock("./data-source-service", () => {
    return {
        dataSourceService: {
            listForWebsite: vi.fn(),
            create: vi.fn(),
            delete: vi.fn(),
            discover: vi.fn(),
        }
    };
});

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn()
}));

describe("DataSource Actions", () => {
    const mockService = vi.mocked(dataSourceService) as any;
    const websiteId = "website-1";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("listDataSourcesAction returns success result", async () => {
        mockService.listForWebsite.mockResolvedValue({ ok: true, data: [{ id: "s1" }] });
        const result = await listDataSourcesAction(websiteId);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.data).toHaveLength(1);
    });

    it("createDataSourceAction delegates to service", async () => {
        mockService.create.mockResolvedValue({ ok: true, data: { id: "s2" } });
        const result = await createDataSourceAction({ websiteId, name: "API", kind: "REST", config: { baseUrl: "x" } });
        expect(result.ok).toBe(true);
    });

    it("deleteDataSourceAction delegates to service", async () => {
        mockService.delete.mockResolvedValue({ ok: true });
        const result = await deleteDataSourceAction("s1", websiteId);
        expect(result.ok).toBe(true);
    });

    it("discoverDataSourceAction delegates to service", async () => {
        mockService.discover.mockResolvedValue({ ok: true, data: { status: "OK", availableFields: [] } });
        const result = await discoverDataSourceAction("s1", websiteId);
        expect(result.ok).toBe(true);
    });
});
