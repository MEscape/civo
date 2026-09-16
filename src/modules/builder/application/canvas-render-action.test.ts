import { describe, it, expect, vi } from "vitest";
import { renderCanvasAction } from "@/modules/builder/application/canvas-render-action";
import { renderPageNodes } from "@/modules/component-platform/infrastructure/render-nodes";

vi.mock("@/modules/component-platform/infrastructure/render-nodes", () => ({
    renderPageNodes: vi.fn(),
}));

describe("canvas render action", () => {
    it("returns error message when config is invalid", async () => {
        const result = await renderCanvasAction({ invalid: "data" });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.message).toBe("Die aktuelle Seitenkonfiguration ist ungültig.");
        }
    });

    it("returns react node when config is valid", async () => {
        const mockConfig = { type: "page", children: [{ id: "n1", type: "hero", props: {} }] };
        vi.mocked(renderPageNodes).mockReturnValue("MOCK_NODE" as unknown as ReturnType<typeof renderPageNodes>);

        const result = await renderCanvasAction(mockConfig);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.node).toBe("MOCK_NODE");
        }
        expect(renderPageNodes).toHaveBeenCalledWith(mockConfig.children, true, undefined);
    });
});
