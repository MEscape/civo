import type { PageNode } from "@/modules/builder/domain/page-node";

/**
 * Pure page-tree operations (spec Phase 2 §31).
 *
 * Every builder mutation — insert, remove, update props, duplicate, move —
 * goes through exactly one of these functions. They are:
 *
 *   - deterministic
 *   - pure (always return a new tree; never mutate their input)
 *   - independently testable
 *   - independent of React, the DOM, and Redux
 *
 * The Redux builder slice (features/builder/builder-slice.ts) is a thin
 * wrapper around these: it holds the tree in state and calls these
 * functions inside its reducers. Keeping the actual tree algorithms here
 * (rather than inline in reducers) means the same operations can later
 * back autosave, revisions, or server-side transformations without
 * depending on Redux at all (spec §31).
 *
 * All operations work on a full node array (a "forest" — the top level of
 * a PageConfig, or any node's `children`), which keeps them composable:
 * the top-level draft tree and any node's children are manipulated with
 * the exact same functions.
 */

let idCounter = 0;

/**
 * Generates a stable, sufficiently-unique node id. Uses a monotonic
 * counter plus a random suffix rather than array position, per the
 * "never use array indexes as identity" rule that runs through both
 * Phase 1 and Phase 2 of the spec.
 */
export function generateNodeId(type: string): string {
    idCounter += 1;
    const random = Math.random().toString(36).slice(2, 8);
    return `${type}-${Date.now().toString(36)}-${idCounter}-${random}`;
}

/**
 * Finds a node by id anywhere in the tree, returning both the node and
 * its parent's children array + index — enough context for callers to
 * perform their own splice-free operations if needed. Returns null if
 * not found.
 */
export type NodeLocation = {
    node: PageNode;
    /** The array the node currently lives in (a parent's `children`, or the root). */
    siblings: PageNode[];
    index: number;
    /** The id of the containing parent node, or null if this is a root-level node. */
    parentId: string | null;
};

export function locateNode(nodes: PageNode[], nodeId: string, parentId: string | null = null): NodeLocation | null {
    for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index];
        if (node.id === nodeId) {
            return { node, siblings: nodes, index, parentId };
        }
        if (node.children) {
            const found = locateNode(node.children, nodeId, node.id);
            if (found) return found;
        }
    }
    return null;
}

/** Finds a node by id anywhere in the tree. Returns null if not found. */
export function findNode(nodes: PageNode[], nodeId: string): PageNode | null {
    return locateNode(nodes, nodeId)?.node ?? null;
}

/**
 * Returns the chain of ancestor node ids from the root down to (but not
 * including) the given node — used for the properties panel's breadcrumb
 * (spec §37).
 */
export function getAncestorPath(nodes: PageNode[], nodeId: string): PageNode[] {
    const path: PageNode[] = [];

    function walk(current: PageNode[], trail: PageNode[]): boolean {
        for (const node of current) {
            if (node.id === nodeId) {
                path.push(...trail);
                return true;
            }
            if (node.children && walk(node.children, [...trail, node])) {
                return true;
            }
        }
        return false;
    }

    walk(nodes, []);
    return path;
}

/**
 * Inserts a node into the tree.
 *
 * - `parentId: null` inserts at the root level.
 * - `parentId: <id>` inserts as a child of that node (the node must
 *   already exist and — enforcement of *whether* it's allowed to accept
 *   children is the registry's job via `canInsertChild`, not this
 *   function's; this is a mechanical operation, not a policy one).
 * - `index` controls position within the target siblings array; omitted
 *   or out-of-range appends to the end.
 *
 * Returns a new tree; does not mutate `nodes`.
 */
export function insertNode(
    nodes: PageNode[],
    newNode: PageNode,
    options: { parentId: string | null; index?: number }
): PageNode[] {
    const { parentId, index } = options;

    if (parentId === null) {
        const next = [...nodes];
        const at = index === undefined || index > next.length ? next.length : Math.max(0, index);
        next.splice(at, 0, newNode);
        return next;
    }

    return mapTree(nodes, (node) => {
        if (node.id !== parentId) return node;
        const children = node.children ? [...node.children] : [];
        const at = index === undefined || index > children.length ? children.length : Math.max(0, index);
        children.splice(at, 0, newNode);
        return { ...node, children };
    });
}

/** Removes a node (and its subtree) from anywhere in the tree. */
export function removeNode(nodes: PageNode[], nodeId: string): PageNode[] {
    const filtered = nodes.filter((node) => node.id !== nodeId);
    let changed = filtered.length !== nodes.length;

    const newNodes = filtered.map((node) => {
        if (node.children) {
            const newChildren = removeNode(node.children, nodeId);
            if (newChildren !== node.children) {
                changed = true;
                return { ...node, children: newChildren };
            }
        }
        return node;
    });

    return changed ? newNodes : nodes;
}

/**
 * Merges new props onto a node's existing props (a shallow merge —
 * unrelated properties are always preserved, per spec §20 rule 3).
 */
export function updateNodeProps(
    nodes: PageNode[],
    nodeId: string,
    props: Record<string, unknown>
): PageNode[] {
    return mapTree(nodes, (node) => {
        if (node.id !== nodeId) return node;
        return { ...node, props: { ...node.props, ...props } };
    });
}

/** Replaces a node in place with a full replacement, preserving its position. */
export function replaceNode(nodes: PageNode[], nodeId: string, replacement: PageNode): PageNode[] {
    return mapTree(nodes, (node) => (node.id === nodeId ? replacement : node));
}

/**
 * Duplicates a node (and, recursively, its entire subtree), inserting the
 * copy immediately after the original among its current siblings. Every
 * node in the copied subtree gets a fresh id — ids are never copied
 * (spec §16).
 */
export function duplicateNode(nodes: PageNode[], nodeId: string): { tree: PageNode[]; newNodeId: string } | null {
    const location = locateNode(nodes, nodeId);
    if (!location) return null;

    const clone = cloneWithFreshIds(location.node);

    const tree =
        location.parentId === null
            ? spliceAfter(nodes, location.index, clone)
            : mapTree(nodes, (node) => {
                if (node.id !== location.parentId || !node.children) return node;
                return { ...node, children: spliceAfter(node.children, location.index, clone) };
            });

    return { tree, newNodeId: clone.id };
}

/**
 * Moves an existing node to a new parent (or the root) at a given index.
 * Implemented as remove-then-insert on an already-validated location so
 * the moved subtree (including all descendant ids) is preserved exactly.
 *
 * This function performs no policy checks (nesting depth, compatible
 * container types) — callers should check `canInsertChild` from the
 * component registry before calling this, exactly as insertNode leaves
 * that check to its caller.
 */
export function moveNode(
    nodes: PageNode[],
    nodeId: string,
    target: { parentId: string | null; index?: number }
): PageNode[] {
    const location = locateNode(nodes, nodeId);
    if (!location) return nodes;

    // Guard against moving a node into its own subtree, which would create
    // a cycle (spec §32: "moving a node cannot create invalid cycles").
    if (target.parentId !== null && isDescendant(location.node, target.parentId)) {
        return nodes;
    }

    const withoutNode = removeNode(nodes, nodeId);
    return insertNode(withoutNode, location.node, target);
}

/** True if `candidateId` identifies a node anywhere within `node`'s own subtree. */
function isDescendant(node: PageNode, candidateId: string): boolean {
    if (!node.children) return false;
    for (const child of node.children) {
        if (child.id === candidateId || isDescendant(child, candidateId)) return true;
    }
    return false;
}

/** Recursively applies `fn` to every node in the tree, rebuilding children immutably using structural sharing. */
function mapTree(nodes: PageNode[], fn: (node: PageNode) => PageNode): PageNode[] {
    let changed = false;
    const newNodes = nodes.map((node) => {
        const mapped = fn(node);
        if (mapped.children) {
            const newChildren = mapTree(mapped.children, fn);
            if (newChildren !== mapped.children) {
                changed = true;
                return { ...mapped, children: newChildren };
            }
        }
        if (mapped !== node) {
            changed = true;
        }
        return mapped;
    });
    return changed ? newNodes : nodes;
}

function spliceAfter(nodes: PageNode[], index: number, node: PageNode): PageNode[] {
    const next = [...nodes];
    next.splice(index + 1, 0, node);
    return next;
}

function cloneWithFreshIds(node: PageNode): PageNode {
    return {
        ...node,
        id: generateNodeId(node.type),
        props: { ...node.props },
        children: node.children?.map(cloneWithFreshIds),
    };
}
