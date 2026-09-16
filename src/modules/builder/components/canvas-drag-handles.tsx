"use client";

import { GripVertical } from "@/components/ui/icons";
import type { FlatNode } from "@/modules/builder/domain/drop-placement";
import type { Rect } from "@/modules/builder/domain/drop-placement";

type CanvasDragHandlesProps = {
    flatNodes: FlatNode[];
    getRect: (nodeId: string) => Rect | null;
    getLabel: (type: string) => string;
    activeNodeId: string | null;
    keyboardActive: boolean;
    onKeyDown: (nodeId: string, event: React.KeyboardEvent) => void;
};

/**
 * Renders a small, real, keyboard-focusable grip button in the top-left
 * corner of every node's measured rect. Screen-reader and keyboard users
 * tab to a node's grip, press Space/Enter to pick it up, Arrow Up/Down to
 * choose a new position, and Space/Enter again to drop — driven entirely
 * by useCanvasDnd's keyboard state machine (spec §12).
 *
 * Only the CURRENTLY ACTIVE node's grip is visually emphasized while a
 * keyboard drag is in progress; all grips remain individually focusable
 * at all times so this never depends on mouse hover to be discoverable.
 */
export function CanvasDragHandles({
                                      flatNodes,
                                      getRect,
                                      getLabel,
                                      activeNodeId,
                                      keyboardActive,
                                      onKeyDown,
                                  }: CanvasDragHandlesProps) {
    return (
        <>
            {flatNodes.map(({ node }) => {
                const rect = getRect(node.id);
                if (!rect) return null;
                const isActive = keyboardActive && activeNodeId === node.id;
                return (
                    <button
                        key={node.id}
                        type="button"
                        data-civo-drag-handle={node.id}
                        aria-label={
                            isActive
                                ? `${getLabel(node.type)} wird verschoben. Pfeiltasten zum Verschieben, Eingabe zum Ablegen, Escape zum Abbrechen.`
                                : `${getLabel(node.type)} verschieben`
                        }
                        aria-pressed={isActive}
                        onKeyDown={(event) => onKeyDown(node.id, event)}
                        className="civo-drag-handle"
                        style={{ top: rect.top + 4, left: rect.left + 4 }}
                    >
                        <GripVertical className="h-3 w-3" />
                    </button>
                );
            })}
        </>
    );
}
