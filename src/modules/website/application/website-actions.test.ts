import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWebsiteAction, updateWebsiteAction, updateThemeAction } from "@/modules/website/application/website-actions";
import { websiteService } from "@/modules/website/infrastructure/website-service";
import { revalidatePath } from "next/cache";
import { ok, err } from "@/lib/result/result";
import { AppErrors } from "@/lib/errors/app-error";

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}));

vi.mock("@/modules/website/infrastructure/website-service", () => ({
    websiteService: {
        create: vi.fn(),
        update: vi.fn(),
        updateTheme: vi.fn(),
    },
}));

describe("website actions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("createWebsiteAction", () => {
        it("returns success and revalidates when creation succeeds", async () => {
            const mockWebsite = { id: "w1", name: "Test", slug: "test", templateKey: "municipal", createdAt: new Date(), updatedAt: new Date(), description: null, theme: null, themeId: null };
            vi.mocked(websiteService.create).mockResolvedValue(ok(mockWebsite));

            const result = await createWebsiteAction({ name: "Test", slug: "test", templateKey: "municipal" });

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.data).toEqual(mockWebsite);
            }
            expect(revalidatePath).toHaveBeenCalledWith("/websites");
        });

        it("returns error and does not revalidate when creation fails", async () => {
            vi.mocked(websiteService.create).mockResolvedValue(err(AppErrors.conflict("Slug exists")));

            const result = await createWebsiteAction({ name: "Test", slug: "test", templateKey: "municipal" });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.message).toBe("Slug exists");
            }
            expect(revalidatePath).not.toHaveBeenCalled();
        });
    });

    describe("updateWebsiteAction", () => {
        it("returns success and revalidates when update succeeds", async () => {
            const mockWebsite = { id: "w1", name: "Test", slug: "test", templateKey: "municipal", createdAt: new Date(), updatedAt: new Date(), description: null, theme: null, themeId: null };
            vi.mocked(websiteService.update).mockResolvedValue(ok(mockWebsite));

            const result = await updateWebsiteAction({ id: "w1", name: "Updated" });

            expect(result.ok).toBe(true);
            expect(revalidatePath).toHaveBeenCalledWith("/websites");
            expect(revalidatePath).toHaveBeenCalledWith("/websites/w1");
        });

        it("returns error and does not revalidate when update fails", async () => {
            vi.mocked(websiteService.update).mockResolvedValue(err(AppErrors.notFound("Website")));

            const result = await updateWebsiteAction({ id: "w1", name: "Updated" });

            expect(result.ok).toBe(false);
            expect(revalidatePath).not.toHaveBeenCalled();
        });
    });

    describe("updateThemeAction", () => {
        it("returns success and revalidates when update succeeds", async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            vi.mocked(websiteService.updateTheme).mockResolvedValue(ok({} as any));

            const result = await updateThemeAction("t1", { primaryColor: "#000000" }, "w1");

            expect(result.ok).toBe(true);
            expect(revalidatePath).toHaveBeenCalledWith("/websites/w1");
            expect(revalidatePath).toHaveBeenCalledWith("/websites/w1/builder");
        });

        it("returns error and does not revalidate when update fails", async () => {
            vi.mocked(websiteService.updateTheme).mockResolvedValue(err(AppErrors.notFound("Theme")));

            const result = await updateThemeAction("t1", { primaryColor: "#000000" }, "w1");

            expect(result.ok).toBe(false);
            expect(revalidatePath).not.toHaveBeenCalled();
        });
    });
});
