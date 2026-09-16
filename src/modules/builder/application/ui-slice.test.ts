import { describe, it, expect } from "vitest";
import reducer, {
    hoverNode,
    setMode,
    setViewport,
    type UiState,
} from "@/modules/builder/application/ui-slice";
import { loadPage } from "@/modules/builder/application/document-slice";

const initialState: UiState = {
    hoveredNodeId: null,
    mode: "select",
    viewport: "desktop",
};

describe("ui slice", () => {
    it("should return the initial state", () => {
        expect(reducer(undefined, { type: "unknown" })).toEqual(initialState);
    });

    it("should handle hoverNode", () => {
        const actual = reducer(initialState, hoverNode("hero-1"));
        expect(actual.hoveredNodeId).toBe("hero-1");

        const cleared = reducer(actual, hoverNode(null));
        expect(cleared.hoveredNodeId).toBeNull();
    });

    it("should handle setMode", () => {
        const actual = reducer(initialState, setMode("preview"));
        expect(actual.mode).toBe("preview");
    });

    it("should handle setViewport", () => {
        const actual = reducer(initialState, setViewport("mobile"));
        expect(actual.viewport).toBe("mobile");
    });

    it("should clear hoveredNodeId when loadPage is dispatched", () => {
        const stateWithHover = reducer(initialState, hoverNode("hero-1"));
        expect(stateWithHover.hoveredNodeId).toBe("hero-1");

        const actual = reducer(stateWithHover, loadPage({ pageId: "page-1", children: [] }));
        expect(actual.hoveredNodeId).toBeNull();
    });
});
