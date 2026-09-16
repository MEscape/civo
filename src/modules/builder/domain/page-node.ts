import { z } from "zod";
import { isRegisteredComponentType } from "@/modules/component-platform/domain";

/**
 * PageNode — the JSON/configuration-based representation of a page.
 *
 * A page is a tree of PageNodes. The renderer resolves each node's `type`
 * against a controlled component registry (see
 * src/domain/component-platform) — it never dynamically imports a
 * component name from user-controlled input.
 *
 * Every node has a stable `id`, assigned once at creation time and never
 * derived from array position. This is required for the future drag-and-
 * drop builder (selection, insertion, deletion, reordering, undo/redo all
 * need identity that survives reordering).
 */
export type PageNode = {
    id: string;
    type: string;
    props: Record<string, unknown>;
    children?: PageNode[];
};

/**
 * The root of a page's configuration. Kept as a distinct type from
 * PageNode (rather than "just a node with type: 'page'") so the renderer
 * and the Zod schema can enforce that a page always has a single root of
 * this shape.
 */
export type PageConfig = {
    type: "page";
    children: PageNode[];
};

/**
 * Recursively collects all node ids in a page tree. Useful for validating
 * id uniqueness and for builder operations that need a flat id list.
 */
export function collectNodeIds(nodes: PageNode[]): string[] {
    const ids: string[] = [];
    const visit = (node: PageNode) => {
        ids.push(node.id);
        node.children?.forEach(visit);
    };
    nodes.forEach(visit);
    return ids;
}

/**
 * Finds a node by id anywhere in the tree. Returns undefined if not found.
 */
export function findNodeById(nodes: PageNode[], id: string): PageNode | undefined {
    for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
            const found = findNodeById(node.children, id);
            if (found) return found;
        }
    }
    return undefined;
}
