import { describe, it, expect } from "vitest";
import {
    findNode,
    locateNode,
    getAncestorPath,
    insertNode,
    removeNode,
    updateNodeProps,
    replaceNode,
    duplicateNode,
    moveNode,
    generateNodeId,
} from "@/modules/builder/domain/tree-operations";
import type { PageNode } from "@/modules/builder/domain/page-node";

function makeTree(): PageNode[] {
    return [
        { id: "hero-1", type: "hero", props: { title: "Willkommen" } },
        {
            id: "section-1",
            type: "section",
            props: {},
            children: [
                { id: "news-1", type: "newsGrid", props: { columns: 3 } },
                { id: "events-1", type: "eventsGrid", props: { columns: 2 } },
            ],
        },
    ];
}

describe("generateNodeId", () => {
    it("generates unique ids across many calls", () => {
        const ids = new Set(Array.from({ length: 500 }, () => generateNodeId("hero")));
        expect(ids.size).toBe(500);
    });

    it("includes the type as a prefix for readability", () => {
        expect(generateNodeId("hero")).toMatch(/^hero-/);
    });
});

describe("findNode / locateNode", () => {
    it("finds a root-level node", () => {
        const tree = makeTree();
        expect(findNode(tree, "hero-1")?.type).toBe("hero");
    });

    it("finds a nested node", () => {
        const tree = makeTree();
        expect(findNode(tree, "news-1")?.type).toBe("newsGrid");
    });

    it("returns null for a missing id", () => {
        const tree = makeTree();
        expect(findNode(tree, "does-not-exist")).toBeNull();
    });

    it("locateNode reports correct parentId and index for a root node", () => {
        const tree = makeTree();
        const location = locateNode(tree, "section-1");
        expect(location?.parentId).toBeNull();
        expect(location?.index).toBe(1);
    });

    it("locateNode reports correct parentId and index for a nested node", () => {
        const tree = makeTree();
        const location = locateNode(tree, "events-1");
        expect(location?.parentId).toBe("section-1");
        expect(location?.index).toBe(1);
    });
});

describe("getAncestorPath", () => {
    it("returns an empty path for a root-level node", () => {
        const tree = makeTree();
        expect(getAncestorPath(tree, "hero-1")).toEqual([]);
    });

    it("returns the chain of ancestors for a nested node", () => {
        const tree = makeTree();
        const path = getAncestorPath(tree, "news-1");
        expect(path.map((n) => n.id)).toEqual(["section-1"]);
    });

    it("returns an empty path for an unknown node", () => {
        const tree = makeTree();
        expect(getAncestorPath(tree, "nope")).toEqual([]);
    });
});

describe("insertNode", () => {
    it("inserts at the root level at a given index", () => {
        const tree = makeTree();
        const newNode: PageNode = { id: "cta-1", type: "callToAction", props: {} };
        const result = insertNode(tree, newNode, { parentId: null, index: 1 });
        expect(result.map((n) => n.id)).toEqual(["hero-1", "cta-1", "section-1"]);
    });

    it("appends to the root when index is omitted", () => {
        const tree = makeTree();
        const newNode: PageNode = { id: "cta-1", type: "callToAction", props: {} };
        const result = insertNode(tree, newNode, { parentId: null });
        expect(result.at(-1)?.id).toBe("cta-1");
    });

    it("inserts as a child of an existing node", () => {
        const tree = makeTree();
        const newNode: PageNode = { id: "card-1", type: "card", props: {} };
        const result = insertNode(tree, newNode, { parentId: "section-1", index: 0 });
        const section = findNode(result, "section-1");
        expect(section?.children?.map((n) => n.id)).toEqual(["card-1", "news-1", "events-1"]);
    });

    it("does not mutate the input tree", () => {
        const tree = makeTree();
        const originalLength = tree.length;
        insertNode(tree, { id: "x", type: "hero", props: {} }, { parentId: null });
        expect(tree.length).toBe(originalLength);
    });

    it("clamps an out-of-range index to the end", () => {
        const tree = makeTree();
        const newNode: PageNode = { id: "cta-1", type: "callToAction", props: {} };
        const result = insertNode(tree, newNode, { parentId: null, index: 999 });
        expect(result.at(-1)?.id).toBe("cta-1");
    });
});

describe("removeNode", () => {
    it("removes a root-level node", () => {
        const tree = makeTree();
        const result = removeNode(tree, "hero-1");
        expect(result.map((n) => n.id)).toEqual(["section-1"]);
    });

    it("removes a nested node without disturbing siblings", () => {
        const tree = makeTree();
        const result = removeNode(tree, "news-1");
        const section = findNode(result, "section-1");
        expect(section?.children?.map((n) => n.id)).toEqual(["events-1"]);
    });

    it("removing a parent removes its entire subtree", () => {
        const tree = makeTree();
        const result = removeNode(tree, "section-1");
        expect(findNode(result, "news-1")).toBeNull();
        expect(findNode(result, "events-1")).toBeNull();
    });

    it("is a no-op for an unknown id", () => {
        const tree = makeTree();
        const result = removeNode(tree, "nope");
        expect(result).toEqual(tree);
    });
});

describe("updateNodeProps", () => {
    it("shallow-merges new props onto existing ones", () => {
        const tree = makeTree();
        const result = updateNodeProps(tree, "hero-1", { subtitle: "Neu" });
        const node = findNode(result, "hero-1");
        expect(node?.props).toEqual({ title: "Willkommen", subtitle: "Neu" });
    });

    it("preserves unrelated properties", () => {
        const tree = makeTree();
        const result = updateNodeProps(tree, "news-1", { limit: 6 });
        const node = findNode(result, "news-1");
        expect(node?.props).toEqual({ columns: 3, limit: 6 });
    });

    it("updates a nested node's props", () => {
        const tree = makeTree();
        const result = updateNodeProps(tree, "events-1", { columns: 4 });
        const node = findNode(result, "events-1");
        expect(node?.props.columns).toBe(4);
    });

    it("does not mutate the input tree", () => {
        const tree = makeTree();
        updateNodeProps(tree, "hero-1", { title: "Changed" });
        expect(findNode(tree, "hero-1")?.props.title).toBe("Willkommen");
    });
});

describe("replaceNode", () => {
    it("replaces a node while preserving its position", () => {
        const tree = makeTree();
        const replacement: PageNode = { id: "hero-1", type: "hero", props: { title: "Ersetzt" } };
        const result = replaceNode(tree, "hero-1", replacement);
        expect(result[0]).toEqual(replacement);
    });
});

describe("duplicateNode", () => {
    it("inserts a copy immediately after the original", () => {
        const tree = makeTree();
        const result = duplicateNode(tree, "hero-1");
        expect(result).not.toBeNull();
        expect(result!.tree.map((n) => n.type)).toEqual(["hero", "hero", "section"]);
    });

    it("gives the duplicate a new, different id", () => {
        const tree = makeTree();
        const result = duplicateNode(tree, "hero-1")!;
        expect(result.newNodeId).not.toBe("hero-1");
        expect(result.tree[1].id).toBe(result.newNodeId);
    });

    it("recursively assigns fresh ids to the entire subtree", () => {
        const tree = makeTree();
        const result = duplicateNode(tree, "section-1")!;
        const duplicatedSection = result.tree[2];
        expect(duplicatedSection.id).not.toBe("section-1");
        const childIds = duplicatedSection.children!.map((n) => n.id);
        expect(childIds).not.toContain("news-1");
        expect(childIds).not.toContain("events-1");
        expect(new Set(childIds).size).toBe(2);
    });

    it("preserves props on the duplicate", () => {
        const tree = makeTree();
        const result = duplicateNode(tree, "hero-1")!;
        expect(result.tree[1].props).toEqual({ title: "Willkommen" });
    });

    it("duplicates a nested node within its own parent", () => {
        const tree = makeTree();
        const result = duplicateNode(tree, "news-1")!;
        const section = findNode(result.tree, "section-1");
        expect(section?.children?.map((n) => n.type)).toEqual(["newsGrid", "newsGrid", "eventsGrid"]);
    });

    it("returns null for an unknown id", () => {
        const tree = makeTree();
        expect(duplicateNode(tree, "nope")).toBeNull();
    });
});

describe("moveNode", () => {
    it("moves a root-level node into a container", () => {
        const tree = makeTree();
        const result = moveNode(tree, "hero-1", { parentId: "section-1", index: 0 });
        expect(findNode(result, "hero-1")).not.toBeNull();
        const section = findNode(result, "section-1");
        expect(section?.children?.[0].id).toBe("hero-1");
        expect(result.find((n) => n.id === "hero-1")).toBeUndefined();
    });

    it("moves a nested node back to the root", () => {
        const tree = makeTree();
        const result = moveNode(tree, "news-1", { parentId: null, index: 0 });
        expect(result[0].id).toBe("news-1");
        const section = findNode(result, "section-1");
        expect(section?.children?.map((n) => n.id)).toEqual(["events-1"]);
    });

    it("reorders within the same parent", () => {
        const tree = makeTree();
        const result = moveNode(tree, "events-1", { parentId: "section-1", index: 0 });
        const section = findNode(result, "section-1");
        expect(section?.children?.map((n) => n.id)).toEqual(["events-1", "news-1"]);
    });

    it("refuses to move a node into its own subtree (prevents cycles)", () => {
        const tree = makeTree();
        const result = moveNode(tree, "section-1", { parentId: "news-1", index: 0 });
        expect(findNode(result, "section-1")?.children?.map((n) => n.id)).toEqual(["news-1", "events-1"]);
    });

    it("is a no-op for an unknown node id", () => {
        const tree = makeTree();
        const result = moveNode(tree, "nope", { parentId: null });
        expect(result).toEqual(tree);
    });
});
