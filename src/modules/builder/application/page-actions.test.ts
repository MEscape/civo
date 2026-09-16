import { describe, it, expect, vi, beforeEach } from "vitest";
import { savePageConfigAction, createPageAction } from "@/modules/builder/application/page-actions";
import type { PageConfigInput } from "@/modules/builder/domain/page-schema";
import type { PageWithConfig } from "@/modules/builder/infrastructure/page-repository";
import { pageService } from "@/modules/builder/infrastructure/page-service";
import { revalidatePath } from "next/cache";
import { ok, err } from "@/lib/result/result";
import { AppErrors } from "@/lib/errors/app-error";

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}));

vi.mock("@/modules/builder/infrastructure/page-service", () => ({
    pageService: {
        saveConfig: vi.fn(),
        create: vi.fn(),
    },
}));

describe("page actions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("savePageConfigAction", () => {
        it("returns success and revalidates when save succeeds", async () => {
            const mockConfig = { children: [] };
            vi.mocked(pageService.saveConfig).mockResolvedValue(ok(mockConfig as unknown as PageConfigInput));

            const result = await savePageConfigAction("p1", "w1", { children: [] });

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.data).toEqual(mockConfig);
            }
            expect(revalidatePath).toHaveBeenCalledWith("/websites/w1/builder");
            expect(revalidatePath).toHaveBeenCalledWith("/w1");
        });

        it("returns error and does not revalidate when save fails", async () => {
            vi.mocked(pageService.saveConfig).mockResolvedValue(err(AppErrors.notFound("Page")));

            const result = await savePageConfigAction("p1", "w1", { children: [] });

            expect(result.ok).toBe(false);
            expect(revalidatePath).not.toHaveBeenCalled();
        });
    });

    describe("createPageAction", () => {
        it("returns success and revalidates when creation succeeds", async () => {
            const mockPage = { id: "p1", websiteId: "w1", path: "/test", title: "Test", configs: [] };
            vi.mocked(pageService.create).mockResolvedValue(ok(mockPage as unknown as PageWithConfig));

            const result = await createPageAction({ websiteId: "w1", path: "/test", title: "Test" });

            expect(result.ok).toBe(true);
            expect(revalidatePath).toHaveBeenCalledWith("/websites/w1/builder");
        });

        it("returns error and does not revalidate when creation fails", async () => {
            vi.mocked(pageService.create).mockResolvedValue(err(AppErrors.conflict("Path exists")));

            const result = await createPageAction({ websiteId: "w1", path: "/test", title: "Test" });

            expect(result.ok).toBe(false);
            expect(revalidatePath).not.toHaveBeenCalled();
        });
    });
});
