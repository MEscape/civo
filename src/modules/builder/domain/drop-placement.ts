import type { PageNode } from "@/modules/builder/domain/page-node";
import { canInsertChild } from "@/modules/component-platform/domain";

/**
 * Pure drag-and-drop placement logic (Phase 3 spec §10–11).
 *
 * The canvas's actual pixels come from server-rendered components, not
 * from dnd-kit-owned DOM nodes (see builder-canvas.tsx / render-nodes.tsx
 * — every node in edit mode carries a `data-civo-node-id` attribute).
 * This module turns "pointer is at (x, y), currently over rect R
 * belonging to node N" into a concrete, policy-checked tree operation
 * (before N / after N / inside N), without knowing anything about
 * dnd-kit, React, or the DOM itself — kept here (domain/**) rather than
 * inline in the canvas component so it is independently testable and
 * reusable by keyboard-driven movement.
 */

export type FlatNode = { node: PageNode; parentId: string | null; depth: number };

/**
 * Flattens a tree depth-first into a list of every node with its parent id
 * and nesting depth. Order matches render order.
 */
export function flattenTree(nodes: PageNode[], parentId: string | null = null, depth = 0): FlatNode[] {
    const result: FlatNode[] = [];
    for (const node of nodes) {
        result.push({ node, parentId, depth });
        if (node.children) {
            result.push(...flattenTree(node.children, node.id, depth + 1));
        }
    }
    return result;
}

export type DropPosition = "before" | "after" | "inside";

export type DropTarget = {
    /** The node the pointer is hovering over. */
    targetNodeId: string;
    position: DropPosition;
    /** Resolved insertion point once the operation is applied. */
    parentId: string | null;
    index: number;
};

export type Rect = { top: number; left: number; width: number; height: number };

/**
 * The vertical band (as a fraction of the hovered node's height) that
 * resolves to "before" or "after" rather than "inside". A relatively
 * generous band (30%) makes reordering easy to hit; the remaining middle
 * band resolves to "inside" but ONLY when the target can actually accept
 * children (see resolveDropTarget) — so leaf components never show a
 * misleading "inside" affordance.
 */
const EDGE_BAND_RATIO = 0.3;

/**
 * Given the pointer's Y position and the hovered node's rect + whether it
 * can accept children, resolves which of the three drop positions applies.
 * A container with existing children only offers before/after at its own
 * level from the outside — dropping "inside" a non-empty container is
 * done by hovering one of ITS children instead, which is more precise
 * than an ambiguous whole-container "inside" zone once it has content.
 */
export function resolveDropPosition(
    pointerY: number,
    targetRect: Rect,
    targetCanAcceptChildren: boolean,
    targetIsEmpty: boolean
): DropPosition {
    const relativeY = (pointerY - targetRect.top) / targetRect.height;

    if (targetCanAcceptChildren && targetIsEmpty) {
        // An empty container's entire area is "inside" — there is no
        // meaningful before/after edge to distinguish from a container
        // that has nothing in it yet.
        return "inside";
    }

    if (relativeY < EDGE_BAND_RATIO) return "before";
    if (relativeY > 1 - EDGE_BAND_RATIO) return "after";
    return targetCanAcceptChildren ? "inside" : relativeY < 0.5 ? "before" : "after";
}

/**
 * Resolves a full DropTarget (siblings array position, not just a
 * relative label) from a raw position label. Returns null when the drop
 * would be invalid (e.g. dropping into a leaf component, or a cycle).
 *
 * `activeType` is passed explicitly rather than looked up from `activeId`
 * in the tree, because a drag source is not always an existing node — a
 * component being dragged in fresh from the palette (spec §10) has a
 * type but no tree id yet. Callers dragging an EXISTING node should also
 * pre-check `isDescendantOf`/self-id themselves before calling this (see
 * use-canvas-dnd.ts), since a synthetic "new node" id can never collide
 * with a real one and this function only guards the self-drop case
 * directly.
 */
export function resolveDropTarget(
    tree: PageNode[],
    activeId: string,
    activeType: string,
    targetEntry: FlatNode,
    position: DropPosition
): DropTarget | null {
    const { node: targetNode, parentId: targetParentId } = targetEntry;

    if (targetNode.id === activeId) return null; // dropping onto itself

    if (position === "inside") {
        if (!canInsertChild(targetNode.type, activeType)) return null;
        const childCount = targetNode.children?.length ?? 0;
        return { targetNodeId: targetNode.id, position, parentId: targetNode.id, index: childCount };
    }

    // "before" / "after" insert as a sibling of the target, at the
    // target's level — so the containing parent must accept the active
    // node's type (root level always accepts any registered type).
    const parentType = targetParentId ? getNodeType(tree, targetParentId) : null;
    if (!canInsertChild(parentType, activeType)) {
        return null;
    }

    return {
        targetNodeId: targetNode.id,
        position,
        parentId: targetParentId,
        index: -1, // resolved against live sibling order by the caller (siblings shift once activeId is removed)
    };
}

function getNodeType(tree: PageNode[], nodeId: string): string | null {
    const found = flattenTree(tree).find((entry) => entry.node.id === nodeId);
    return found?.node.type ?? null;
}

/**
 * Prevents dropping a node into itself or one of its own descendants —
 * checked here too (not just in tree-operations.moveNode) so the UI can
 * refuse to even show a drop indicator for an impossible operation,
 * per spec §11 ("never rely solely on UI restrictions" cuts both ways:
 * the tree operation is the source of truth, but the UI should not
 * dangle a promise it can't keep).
 */
export function isDescendantOf(tree: PageNode[], candidateAncestorId: string, nodeId: string): boolean {
    const node = flattenTree(tree).find((entry) => entry.node.id === nodeId)?.node;
    if (!node?.children) return false;
    for (const child of node.children) {
        if (child.id === candidateAncestorId || isDescendantOf(tree, candidateAncestorId, child.id)) {
            return true;
        }
    }
    return false;
}
