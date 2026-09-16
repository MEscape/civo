import { describe, it, expect } from "vitest";
import reducer, {
    loadPage,
    insertNodeAction,
    moveNodeAction,
    undo,
    redo,
    type DocumentState,
} from "@/modules/builder/application/document-slice";
import { resolveMoveIndex, findNode } from "@/modules/builder/domain/tree-operations";
import {
    flattenTree,
    resolveDropPosition,
    resolveDropTarget,
    type FlatNode,
} from "@/modules/builder/domain/drop-placement";
import type { PageNode } from "@/modules/builder/domain/page-node";

/**
 * These tests exercise the SAME sequence use-drop-handler.ts performs on
 * a real drop — resolve a DropTarget from placement logic, resolve its
 * final sibling index against live tree state, then dispatch the
 * resulting action — against the real document-slice reducer, without
 * mocking Redux. This is the integration seam between Milestone 2 (DnD
 * mechanics) and the pre-existing, already-tested undo/redo and
 * persistence-draft architecture (spec §13, §63's Definition of Done).
 */

function makeTree(): PageNode[] {
    return [
        { id: "hero-1", type: "hero", props: {} },
        {
            id: "section-1",
            type: "section",
            props: {},
            children: [{ id: "news-1", type: "newsGrid", props: {} }],
        },
    ];
}

function loaded(nodes: PageNode[] = makeTree()): DocumentState {
    return reducer(undefined, loadPage({ pageId: "page-1", children: nodes }));
}

/** Simulates a completed drag: resolves a DropTarget, then dispatches moveNodeAction exactly as use-drop-handler.ts does. */
function simulateNodeDrop(
    state: DocumentState,
    activeNodeId: string,
    targetNodeId: string,
    position: "before" | "after" | "inside"
): DocumentState {
    const tree = state.history.present.children;
    const flat = flattenTree(tree);
    const targetEntry = flat.find((entry) => entry.node.id === targetNodeId) as FlatNode;
    const activeType = flat.find((entry) => entry.node.id === activeNodeId)!.node.type;

    const dropTarget = resolveDropTarget(tree, activeNodeId, activeType, targetEntry, position);
    expect(dropTarget).not.toBeNull();
    if (!dropTarget) throw new Error("unreachable");

    const index =
        dropTarget.index >= 0
            ? dropTarget.index
            : resolveMoveIndex(tree, activeNodeId, {
                parentId: dropTarget.parentId,
                targetNodeId: dropTarget.targetNodeId,
                position: dropTarget.position as "before" | "after",
            });

    return reducer(state, moveNodeAction({ nodeId: activeNodeId, parentId: dropTarget.parentId, index }));
}

describe("DnD integration: full drag -> placement -> reducer -> history pipeline", () => {
    it("reorders a root-level node via a real 'before' drop and produces exactly one history entry", () => {
        const initial = loaded(); // [hero-1, section-1]
        const afterDrop = simulateNodeDrop(initial, "section-1", "hero-1", "before");

        expect(afterDrop.history.present.children.map((n) => n.id)).toEqual(["section-1", "hero-1"]);
        expect(afterDrop.history.past).toHaveLength(1);
        expect(afterDrop.history.future).toHaveLength(0);
    });

    it("moves a node into a container via a real 'inside' drop", () => {
        const initial = loaded(); // hero-1, section-1 > [news-1]
        const afterDrop = simulateNodeDrop(initial, "hero-1", "section-1", "inside");

        expect(afterDrop.history.present.children.map((n) => n.id)).toEqual(["section-1"]);
        const section = findNode(afterDrop.history.present.children, "section-1");
        expect(section?.children?.map((n) => n.id)).toEqual(["news-1", "hero-1"]);
    });

    it("moves a node out of a container back to root via a real 'after' drop", () => {
        const initial = loaded();
        const afterDrop = simulateNodeDrop(initial, "news-1", "section-1", "after");

        expect(afterDrop.history.present.children.map((n) => n.id)).toEqual(["hero-1", "section-1", "news-1"]);
        const section = findNode(afterDrop.history.present.children, "section-1");
        expect(section?.children ?? []).toEqual([]);
    });

    it("undo restores the exact pre-drag tree after a drag operation, and redo re-applies it", () => {
        const initial = loaded();
        const afterDrop = simulateNodeDrop(initial, "section-1", "hero-1", "before");

        const afterUndo = reducer(afterDrop, undo());
        expect(afterUndo.history.present.children).toEqual(initial.history.present.children);

        const afterRedo = reducer(afterUndo, redo());
        expect(afterRedo.history.present.children).toEqual(afterDrop.history.present.children);
    });

    it("refuses to resolve a drop target for an invalid nesting (leaf component)", () => {
        const initial = loaded();
        const tree = initial.history.present.children;
        const flat = flattenTree(tree);
        const heroEntry = flat.find((entry) => entry.node.id === "hero-1") as FlatNode;

        // Attempting to drop news-1 "inside" hero-1 (a leaf) must resolve to null.
        const dropTarget = resolveDropTarget(tree, "news-1", "newsGrid", heroEntry, "inside");
        expect(dropTarget).toBeNull();
    });

    it("refuses to resolve a drop target for a self-drop", () => {
        const initial = loaded();
        const tree = initial.history.present.children;
        const flat = flattenTree(tree);
        const heroEntry = flat.find((entry) => entry.node.id === "hero-1") as FlatNode;

        const dropTarget = resolveDropTarget(tree, "hero-1", "hero", heroEntry, "before");
        expect(dropTarget).toBeNull();
    });

    it("inserting a new component from the palette via a real 'inside' drop selects the new node and creates one history entry", () => {
        const initial = loaded();
        const tree = initial.history.present.children;
        const flat = flattenTree(tree);
        const sectionEntry = flat.find((entry) => entry.node.id === "section-1") as FlatNode;

        const dropTarget = resolveDropTarget(tree, "__new-component__", "richText", sectionEntry, "inside");
        expect(dropTarget).not.toBeNull();
        if (!dropTarget) throw new Error("unreachable");

        const newNode: PageNode = { id: "rich-1", type: "richText", props: {} };
        const index =
            dropTarget.index >= 0
                ? dropTarget.index
                : resolveMoveIndex(tree, "__new-component__", {
                    parentId: dropTarget.parentId,
                    targetNodeId: dropTarget.targetNodeId,
                    position: dropTarget.position as "before" | "after",
                });

        const afterDrop = reducer(initial, insertNodeAction({ node: newNode, parentId: dropTarget.parentId, index }));

        const section = findNode(afterDrop.history.present.children, "section-1");
        expect(section?.children?.map((n) => n.id)).toEqual(["news-1", "rich-1"]);
        expect(afterDrop.history.present.selectedNodeId).toBe("rich-1");
        expect(afterDrop.history.past).toHaveLength(1);
    });

    it("resolveDropPosition + resolveDropTarget agree with the reducer on a full 'drag near the top edge' scenario", () => {
        // Simulates the pointer being in the top 30% of section-1's rect,
        // which resolveDropPosition should classify as "before" even
        // though section-1 can accept children (it's not empty).
        const initial = loaded(); // [hero-1, section-1]
        const rect = { top: 100, left: 0, width: 400, height: 200 };
        const position = resolveDropPosition(110, rect, true, false); // 5% down -> before
        expect(position).toBe("before");

        // hero-1 is already immediately before section-1, so dropping
        // hero-1 "before section-1" is a no-op reorder — the real
        // assertion here is that placement classification and the
        // reducer agree, not that the order changes.
        const afterDrop = simulateNodeDrop(initial, "hero-1", "section-1", position);
        expect(afterDrop.history.present.children.map((n) => n.id)).toEqual(["hero-1", "section-1"]);

        // A more meaningful "before" move: drag section-1 to before hero-1.
        const afterSecondDrop = simulateNodeDrop(initial, "section-1", "hero-1", position);
        expect(afterSecondDrop.history.present.children.map((n) => n.id)).toEqual(["section-1", "hero-1"]);
    });
});
