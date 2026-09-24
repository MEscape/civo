import { describe, it, expect } from "vitest";
import reducer, {
    loadPage,
    selectNode,
    insertNodeAction,
    removeNodeAction,
    duplicateNodeAction,
    moveNodeAction,
    updateNodePropsAction,
    commitPropsHistory,
    undo,
    redo,
    type DocumentState,
} from "@/modules/builder/application/document-slice";
import type { PageNode } from "@/modules/builder/domain/page-node";

const heroNode: PageNode = { id: "hero-1", type: "hero", props: { title: "Willkommen" } };
const newsNode: PageNode = { id: "news-1", type: "newsGrid", props: { columns: 3 } };

function loaded(nodes: PageNode[] = [heroNode, newsNode]): DocumentState {
    return reducer(undefined, loadPage({ pageId: "page-1", children: nodes }));
}

describe("document slice: loadPage", () => {
    it("sets the draft tree and pageId, and resets history/dirty state", () => {
        const state = loaded();
        expect(state.pageId).toBe("page-1");
        expect(state.history.present.children).toEqual([heroNode, newsNode]);
        expect(state.history.past).toEqual([]);
        expect(state.history.future).toEqual([]);
    });
});

describe("document slice: selection", () => {
    it("selectNode sets the selected node id", () => {
        const state = reducer(loaded(), selectNode("hero-1"));
        expect(state.history.present.selectedNodeId).toBe("hero-1");
    });

    it("selectNode(null) clears selection", () => {
        let state = reducer(loaded(), selectNode("hero-1"));
        state = reducer(state, selectNode(null));
        expect(state.history.present.selectedNodeId).toBeNull();
    });

    it("selectNode does not create a history entry", () => {
        const state = reducer(loaded(), selectNode("hero-1"));
        expect(state.history.past).toHaveLength(0);
    });

});

describe("document slice: insertion", () => {
    it("inserts a node and selects it", () => {
        const newNode: PageNode = { id: "cta-1", type: "callToAction", props: {} };
        const state = reducer(loaded(), insertNodeAction({ node: newNode, parentId: null }));
        expect(state.history.present.children.at(-1)).toEqual(newNode);
        expect(state.history.present.selectedNodeId).toBe("cta-1");
    });

    it("marks the draft dirty and creates a history entry", () => {
        const newNode: PageNode = { id: "cta-1", type: "callToAction", props: {} };
        const state = reducer(loaded(), insertNodeAction({ node: newNode, parentId: null }));
        expect(state.history.past).toHaveLength(1);
    });
});

describe("document slice: deletion", () => {
    it("removes the node from the draft tree", () => {
        const state = reducer(loaded(), removeNodeAction("hero-1"));
        expect(state.history.present.children.map((n: PageNode) => n.id)).toEqual(["news-1"]);
    });

    describe("selection after deleting the selected node", () => {
        const selectedAfterDeleting = (tree: PageNode[], selected: string, deleted = selected) => {
            let state = reducer(loaded(tree), selectNode(selected));
            state = reducer(state, removeNodeAction(deleted));
            return state.history.present.selectedNodeId;
        };
        const child = (id: string): PageNode => ({ id, type: "text", props: {} });
        const section = (id: string, children: PageNode[]): PageNode => ({ id, type: "section", props: {}, children });

        it("selects the NEXT sibling when there is one", () => {
            expect(selectedAfterDeleting([heroNode, newsNode], "hero-1")).toBe("news-1");
        });

        it("selects the PREVIOUS sibling when the deleted node was last", () => {
            expect(selectedAfterDeleting([heroNode, newsNode], "news-1")).toBe("hero-1");
        });

        it("prefers the next sibling over the previous one when the deleted node is in the middle", () => {
            expect(selectedAfterDeleting([child("a"), child("b"), child("c")], "b")).toBe("c");
        });

        it("selects nothing when the deleted node was the only node on the page", () => {
            expect(selectedAfterDeleting([heroNode], "hero-1")).toBeNull();
        });

        it("selects the PARENT when the deleted node was an only child", () => {
            expect(selectedAfterDeleting([section("sec", [child("only")])], "only")).toBe("sec");
        });

        it("stays within the same container: a nested node's sibling, not a page-level node", () => {
            const tree = [section("sec", [child("x"), child("y")]), heroNode];
            expect(selectedAfterDeleting(tree, "x")).toBe("y");
        });

        it("selects a neighbor that actually exists in the resulting tree", () => {
            let state = reducer(loaded([heroNode, newsNode]), selectNode("hero-1"));
            state = reducer(state, removeNodeAction("hero-1"));
            const ids = state.history.present.children.map((n: PageNode) => n.id);
            expect(ids).toContain(state.history.present.selectedNodeId);
        });
    });

    it("preserves selection if a different node was selected", () => {
        let state = reducer(loaded(), selectNode("news-1"));
        state = reducer(state, removeNodeAction("hero-1"));
        expect(state.history.present.selectedNodeId).toBe("news-1");
    });
});

describe("document slice: duplication", () => {
    it("duplicates the node and selects the duplicate", () => {
        const state = reducer(loaded(), duplicateNodeAction("hero-1"));
        expect(state.history.present.children).toHaveLength(3);
        expect(state.history.present.selectedNodeId).not.toBe("hero-1");
        expect(state.history.present.selectedNodeId).not.toBeNull();
    });

    it("is a no-op for an unknown node id", () => {
        const before = loaded();
        const after = reducer(before, duplicateNodeAction("does-not-exist"));
        expect(after.history.present.children).toEqual(before.history.present.children);
        expect(after.history.past).toHaveLength(0);
    });
});

describe("document slice: move/reorder", () => {
    it("reorders root-level nodes", () => {
        const state = reducer(loaded(), moveNodeAction({ nodeId: "news-1", parentId: null, index: 0 }));
        expect(state.history.present.children.map((n: PageNode) => n.id)).toEqual(["news-1", "hero-1"]);
    });
});

describe("document slice: property updates", () => {
    it("updates props and creates a history entry immediately for the first edit", () => {
        const state = reducer(loaded(), updateNodePropsAction({ nodeId: "hero-1", props: { title: "Neu" } }));
        expect(state.history.present.children[0].props.title).toBe("Neu");
        expect(state.history.past).toHaveLength(1);
        expect(state.history.past[0].children[0].props.title).toBe("Willkommen"); // The old state
    });

    it("multiple rapid updates do not each create a history entry", () => {
        let state = loaded();
        state = reducer(state, updateNodePropsAction({ nodeId: "hero-1", props: { title: "W" } }));
        state = reducer(state, updateNodePropsAction({ nodeId: "hero-1", props: { title: "We" } }));
        state = reducer(state, updateNodePropsAction({ nodeId: "hero-1", props: { title: "Welcome" } }));
        expect(state.history.past).toHaveLength(1);
        expect(state.history.present.children[0].props.title).toBe("Welcome");
    });

    it("commitPropsHistory closes the edit session, allowing subsequent edits to create a new history entry", () => {
        let state = loaded();
        state = reducer(state, updateNodePropsAction({ nodeId: "hero-1", props: { title: "W" } }));
        state = reducer(state, updateNodePropsAction({ nodeId: "hero-1", props: { title: "We" } }));
        state = reducer(state, commitPropsHistory());

        // Start a new burst
        state = reducer(state, updateNodePropsAction({ nodeId: "hero-1", props: { title: "Welcome back" } }));
        expect(state.history.past).toHaveLength(2);
    });

    it("can successfully undo property edits", () => {
        let state = loaded();
        state = reducer(state, updateNodePropsAction({ nodeId: "hero-1", props: { title: "W" } }));
        state = reducer(state, updateNodePropsAction({ nodeId: "hero-1", props: { title: "We" } }));
        state = reducer(state, commitPropsHistory());

        state = reducer(state, undo());
        // Should restore the original state before the burst
        expect(state.history.present.children[0].props.title).toBe("Willkommen");
    });
});

describe("document slice: undo/redo", () => {
    it("undo restores the previous document state", () => {
        let state = loaded();
        state = reducer(state, removeNodeAction("hero-1"));
        expect(state.history.present.children).toHaveLength(1);
        state = reducer(state, undo());
        expect(state.history.present.children).toHaveLength(2);
    });

    it("undo is a no-op when there is no history", () => {
        const state = loaded();
        const after = reducer(state, undo());
        expect(after.history.present.children).toEqual(state.history.present.children);
    });

    it("redo restores an undone change", () => {
        let state = loaded();
        state = reducer(state, removeNodeAction("hero-1"));
        state = reducer(state, undo());
        state = reducer(state, redo());
        expect(state.history.present.children).toHaveLength(1);
    });

    it("a new change after undo clears the redo stack", () => {
        let state = loaded();
        state = reducer(state, removeNodeAction("hero-1"));
        state = reducer(state, undo());
        state = reducer(state, removeNodeAction("news-1"));
        expect(state.history.future).toHaveLength(0);
    });

    it("undo/redo round-trips back to the exact same state", () => {
        const state = loaded();
        const afterRemove = reducer(state, removeNodeAction("hero-1"));
        const afterUndo = reducer(afterRemove, undo());
        expect(afterUndo.history.present.children).toEqual(state.history.present.children);
    });
});
