"use client";

import { useAppDispatch } from "@/store/hooks";
import { insertNodeAction, moveNodeAction } from "@/modules/builder/application/document-slice";
import { componentDefinitions } from "@/modules/component-platform/domain";
import type { PageNode } from "@/modules/builder/domain/page-node";
import { resolveMoveIndex } from "@/modules/builder/domain/tree-operations";
import type { DragSource, DropTarget } from "@/modules/builder/components/use-canvas-dnd";

/**
 * Applies a completed drag-and-drop operation to the draft document.
 *
 * `target.index` is -1 for "before"/"after" drops (see drop-placement.ts
 * — the placement logic only knows the target's CURRENT position, not
 * where it lands once the active node's own removal has shifted
 * siblings); `resolveMoveIndex` fills that in against live sibling order
 * right before dispatch, so the indicator shown during the drag and the
 * actual resulting position always agree.
 */
export function useDropHandler(nodes: PageNode[], onSelect: (id: string) => void) {
    const dispatch = useAppDispatch();

    return (source: DragSource, target: DropTarget) => {
        if (source.kind === "palette") {
                const definition = componentDefinitions.find((def) => def.type === source.componentType);
                if (!definition) return;
                const newNode = definition.createDefaultNode();
                const index =
                    target.index >= 0
                        ? target.index
                        : resolveMoveIndex(nodes, "__new-component__", {
                            parentId: target.parentId,
                            targetNodeId: target.targetNodeId,
                            position: target.position as "before" | "after",
                        });
                dispatch(insertNodeAction({ node: newNode, parentId: target.parentId, index }));
                onSelect(newNode.id);
                return;
            }

            const index =
                target.index >= 0
                    ? target.index
                    : resolveMoveIndex(nodes, source.nodeId, {
                        parentId: target.parentId,
                        targetNodeId: target.targetNodeId,
                        position: target.position as "before" | "after",
                    });
            dispatch(moveNodeAction({ nodeId: source.nodeId, parentId: target.parentId, index }));
            // The moved node stays selected (spec §14) — its id is stable
            // across the move, so no extra lookup is needed.
        onSelect(source.nodeId);
    };
}
