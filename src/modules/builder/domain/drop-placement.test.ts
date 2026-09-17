import { describe, it, expect } from "vitest";
import {
    flattenTree,
    resolveDropPosition,
    resolveDropTarget,
    isDescendantOf,
    type FlatNode,
} from "@/modules/builder/domain/drop-placement";
import type { PageNode } from "@/modules/builder/domain/page-node";

// Note: resolveDropTarget's internal canInsertChild checks depend on the
// component-platform registry being populated with real types like
// "hero"/"section" — see vitest.setup.ts, which registers them globally
// for every test run (this domain/** file cannot do so itself).

function makeTree(): PageNode[] {
    return [
        { id: "hero-1", type: "hero", props: {} },
        {
            id: "section-1",
            type: "section",
            props: {},
            children: [
                { id: "news-1", type: "newsGrid", props: {} },
                { id: "events-1", type: "eventsGrid", props: {} },
            ],
        },
        { id: "section-empty", type: "section", props: {} },
    ];
}

describe("flattenTree", () => {
    it("flattens root and nested nodes in render order with correct parentId/depth", () => {
        const flat = flattenTree(makeTree());
        expect(flat.map((entry) => entry.node.id)).toEqual([
            "hero-1",
            "section-1",
            "news-1",
            "events-1",
            "section-empty",
        ]);
        expect(flat.find((entry) => entry.node.id === "news-1")).toMatchObject({
            parentId: "section-1",
            depth: 1,
        });
        expect(flat.find((entry) => entry.node.id === "hero-1")).toMatchObject({
            parentId: null,
            depth: 0,
        });
    });
});

describe("resolveDropPosition", () => {
    const rect = { top: 100, left: 0, width: 300, height: 100 };

    it("resolves to 'before' in the top edge band", () => {
        expect(resolveDropPosition(110, rect, false, false)).toBe("before"); // 10% down
    });

    it("resolves to 'after' in the bottom edge band", () => {
        expect(resolveDropPosition(185, rect, false, false)).toBe("after"); // 85% down
    });

    it("resolves to 'inside' in the middle band when the target accepts children", () => {
        expect(resolveDropPosition(150, rect, true, false)).toBe("inside"); // 50% down
    });

    it("falls back to before/after in the middle band when the target cannot accept children", () => {
        expect(resolveDropPosition(140, rect, false, false)).toBe("before"); // 40% down, leaf
        expect(resolveDropPosition(160, rect, false, false)).toBe("after"); // 60% down, leaf
    });

    it("always resolves to 'inside' for an empty container, regardless of pointer position", () => {
        expect(resolveDropPosition(101, rect, true, true)).toBe("inside");
        expect(resolveDropPosition(199, rect, true, true)).toBe("inside");
    });
});

describe("resolveDropTarget", () => {
    it("returns null when dropping a node onto itself", () => {
        const tree = makeTree();
        const entry: FlatNode = { node: tree[0], parentId: null, depth: 0 };
        expect(resolveDropTarget(tree, "hero-1", "hero", entry, "before")).toBeNull();
    });

    it("resolves an 'inside' drop into a container that accepts children", () => {
        const tree = makeTree();
        const sectionEntry: FlatNode = { node: tree[1], parentId: null, depth: 0 };
        const result = resolveDropTarget(tree, "hero-1", "hero", sectionEntry, "inside");
        expect(result).toEqual({
            targetNodeId: "section-1",
            position: "inside",
            parentId: "section-1",
            index: 2, // appended after the 2 existing children
        });
    });

    it("refuses an 'inside' drop into a component that cannot accept children", () => {
        const tree = makeTree();
        const heroEntry: FlatNode = { node: tree[0], parentId: null, depth: 0 };
        // Attempting to drop "news-1" inside "hero-1" (a leaf) is invalid.
        const result = resolveDropTarget(tree, "news-1", "newsGrid", heroEntry, "inside");
        expect(result).toBeNull();
    });

    it("resolves a 'before' drop as a sibling at the target's level", () => {
        const tree = makeTree();
        const newsEntry: FlatNode = { node: tree[1].children![0], parentId: "section-1", depth: 1 };
        const result = resolveDropTarget(tree, "events-1", "eventsGrid", newsEntry, "before");
        expect(result).toMatchObject({ targetNodeId: "news-1", position: "before", parentId: "section-1" });
    });

    it("resolves a root-level 'after' drop", () => {
        const tree = makeTree();
        const heroEntry: FlatNode = { node: tree[0], parentId: null, depth: 0 };
        const result = resolveDropTarget(tree, "section-1", "section", heroEntry, "after");
        expect(result).toMatchObject({ targetNodeId: "hero-1", position: "after", parentId: null });
    });

    it("resolves a drop target for a brand-new palette component (no existing tree id)", () => {
        const tree = makeTree();
        const sectionEntry: FlatNode = { node: tree[1], parentId: null, depth: 0 };
        const result = resolveDropTarget(tree, "__palette__", "hero", sectionEntry, "inside");
        expect(result).toEqual({
            targetNodeId: "section-1",
            position: "inside",
            parentId: "section-1",
            index: 2,
        });
    });
});

describe("isDescendantOf", () => {
    it("returns true for a direct child", () => {
        const tree = makeTree();
        expect(isDescendantOf(tree, "news-1", "section-1")).toBe(true);
    });

    it("returns false for unrelated nodes", () => {
        const tree = makeTree();
        expect(isDescendantOf(tree, "hero-1", "section-1")).toBe(false);
    });

    it("returns false for a node with no children", () => {
        const tree = makeTree();
        expect(isDescendantOf(tree, "news-1", "hero-1")).toBe(false);
    });

    it("returns false for an empty container", () => {
        const tree = makeTree();
        expect(isDescendantOf(tree, "news-1", "section-empty")).toBe(false);
    });
});
