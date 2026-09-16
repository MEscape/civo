import { describe, it, expect } from "vitest";
import {
    selectDraftChildren,
    selectSelectedNodeId,
    selectHoveredNodeId,
    selectIsDirty,
    selectSaveStatus,
    selectSaveError,
    selectBuilderMode,
    selectViewport,
    selectBuilderPageId,
    selectCanUndo,
    selectCanRedo,
    selectSelectedNode,
    selectSelectedNodeAncestors,
} from "@/modules/builder/application/builder-selectors";
import type { RootState } from "@/store/store";

const mockState = {
    document: {
        pageId: "page-1",
        history: {
            past: [{}], // Length 1
            present: {
                children: [
                    { id: "hero-1", type: "hero", props: {} },
                    { id: "section-1", type: "section", props: {}, children: [{ id: "text-1", type: "text", props: {} }] }
                ],
                selectedNodeId: "text-1",
            },
            future: [{}, {}], // Length 2
            isEditingProps: false,
        },
    },
    ui: {
        hoveredNodeId: "hero-1",
        mode: "preview" as const,
        viewport: "mobile" as const,
    },
    saveState: {
        isDirty: true,
        saveStatus: "saving" as const,
        saveError: "Failed",
    },
} as unknown as RootState;

describe("builder selectors", () => {
    it("selects document state properties correctly", () => {
        expect(selectDraftChildren(mockState)).toEqual(mockState.document.history.present.children);
        expect(selectSelectedNodeId(mockState)).toBe("text-1");
        expect(selectBuilderPageId(mockState)).toBe("page-1");
    });

    it("selects ui state properties correctly", () => {
        expect(selectHoveredNodeId(mockState)).toBe("hero-1");
        expect(selectBuilderMode(mockState)).toBe("preview");
        expect(selectViewport(mockState)).toBe("mobile");
    });

    it("selects save state properties correctly", () => {
        expect(selectIsDirty(mockState)).toBe(true);
        expect(selectSaveStatus(mockState)).toBe("saving");
        expect(selectSaveError(mockState)).toBe("Failed");
    });

    it("selects undo/redo availability correctly", () => {
        expect(selectCanUndo(mockState)).toBe(true);
        expect(selectCanRedo(mockState)).toBe(true);

        const emptyState = { document: { history: { past: [], future: [] } } } as unknown as RootState;
        expect(selectCanUndo(emptyState)).toBe(false);
        expect(selectCanRedo(emptyState)).toBe(false);
    });

    describe("selectSelectedNode", () => {
        it("returns null if no node is selected", () => {
            const noSelectionState = { document: { history: { present: { children: [], selectedNodeId: null } } } } as unknown as RootState;
            expect(selectSelectedNode(noSelectionState)).toBeNull();
        });

        it("returns the node if selected", () => {
            const node = selectSelectedNode(mockState);
            expect(node).toEqual({ id: "text-1", type: "text", props: {} });
        });
    });

    describe("selectSelectedNodeAncestors", () => {
        it("returns empty array if no node is selected", () => {
            const noSelectionState = { document: { history: { present: { children: [], selectedNodeId: null } } } } as unknown as RootState;
            expect(selectSelectedNodeAncestors(noSelectionState)).toEqual([]);
        });

        it("returns ancestors up to the selected node", () => {
            const ancestors = selectSelectedNodeAncestors(mockState);
            expect(ancestors).toEqual([
                { id: "section-1", type: "section", props: {}, children: [{ id: "text-1", type: "text", props: {} }] }
            ]);
        });
    });
});
