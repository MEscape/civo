"use client";

import { useEffect, useRef, useState } from "react";
import {
    DndContext,
    closestCenter,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useAppDispatch } from "@/store/hooks";
import { removeNodeAction, duplicateNodeAction, moveNodeAction } from "@/modules/builder/application/document-slice";
import { getComponentDefinition, canInsertChild } from "@/modules/component-platform/domain";
import type { PageNode } from "@/modules/builder/domain/page-node";
import { locateNode } from "@/modules/builder/domain/tree-operations";
import { useCanvasRender } from "./use-canvas-render";
import { useCanvasHitTesting } from "./use-canvas-hit-testing";
import { SortableNodeHandle } from "./sortable-node-handle";
import { ThemeProvider } from "@/modules/website/components/theme-provider";
import type { WebsiteTheme } from "@/modules/website/domain/theme";
import { CanvasNodeActions } from "./canvas-node-actions";
import { CanvasEmptyState } from "./canvas-empty-state";
import "./builder-canvas.css";

type BuilderCanvasProps = {
    nodes: PageNode[];
    selectedNodeId: string | null;
    onSelect: (id: string | null) => void;
    viewport: "desktop" | "tablet" | "mobile";
    theme?: WebsiteTheme;
};

const viewportWidths: Record<BuilderCanvasProps["viewport"], string> = {
    desktop: "100%",
    tablet: "768px",
    mobile: "390px",
};

/**
 * Flattens the tree depth-first into a list of every node along with its
 * parent id, so the invisible sortable layer can represent drop targets
 * at ANY nesting level — not just the root — which is what makes
 * dropping a component INTO a Section possible (spec §13). Order matches
 * render order, which is what dnd-kit's sortable strategy expects.
 */
type FlatNode = { node: PageNode; parentId: string | null };

function flattenTree(nodes: PageNode[], parentId: string | null = null): FlatNode[] {
    const result: FlatNode[] = [];
    for (const node of nodes) {
        result.push({ node, parentId });
        if (node.children) {
            result.push(...flattenTree(node.children, node.id));
        }
    }
    return result;
}

export function BuilderCanvas({ nodes, selectedNodeId, onSelect, viewport, theme }: BuilderCanvasProps) {
    const dispatch = useAppDispatch();
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    const { node, isRendering, error } = useCanvasRender(nodes);
    const { measure, selectedRect, setSelectedRect, hoveredRect, setHoveredRect } = useCanvasHitTesting(
        containerRef,
        {
            onSelect,
            onHover: setHoveredNodeId,
        }
    );

    useEffect(() => {
        setSelectedRect(measure(selectedNodeId));
    }, [selectedNodeId, node, measure, setSelectedRect]);

    useEffect(() => {
        setHoveredRect(hoveredNodeId && hoveredNodeId !== selectedNodeId ? measure(hoveredNodeId) : null);
    }, [hoveredNodeId, selectedNodeId, node, measure, setHoveredRect]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const flatNodes = flattenTree(nodes);

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activeId = String(active.id);
        const overId = String(over.id);

        const activeEntry = flatNodes.find((entry) => entry.node.id === activeId);
        const overEntry = flatNodes.find((entry) => entry.node.id === overId);
        if (!activeEntry || !overEntry) return;

        const targetParentId = overEntry.parentId;
        const activeType = activeEntry.node.type;

        if (!canInsertChild(targetParentId, activeType)) {
            return;
        }

        const targetSiblings =
            targetParentId === null ? nodes : (locateNode(nodes, targetParentId)?.node.children ?? []);
        const targetIndex = targetSiblings.findIndex((n) => n.id === overId);
        if (targetIndex === -1) return;

        dispatch(moveNodeAction({ nodeId: activeId, parentId: targetParentId, index: targetIndex }));
    }

    const selectedDefinition = selectedNodeId
        ? getComponentDefinition(flatNodes.find((entry) => entry.node.id === selectedNodeId)?.node.type ?? "")
        : undefined;

    if (nodes.length === 0) {
        return <CanvasEmptyState />;
    }

    return (
        <div className="mx-auto transition-[max-width] duration-150" style={{ maxWidth: viewportWidths[viewport] }}>
            <div className="civo-canvas rounded-[var(--civo-radius)] border border-[var(--civo-color-border)] bg-[var(--civo-color-background)]">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={flatNodes.map((entry) => entry.node.id)} strategy={verticalListSortingStrategy}>
                        <div className="sr-only">
                            {flatNodes.map(({ node: pageNode }) => (
                                <SortableNodeHandle
                                    key={pageNode.id}
                                    id={pageNode.id}
                                    label={getComponentDefinition(pageNode.type)?.label ?? pageNode.type}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>

                <div ref={containerRef} className="civo-canvas-content">
                    {theme ? (
                        <ThemeProvider theme={theme}>
                            {node}
                        </ThemeProvider>
                    ) : (
                        node
                    )}
                </div>

                <div className="civo-canvas-overlay">
                    {hoveredRect && (
                        <div
                            className="civo-canvas-outline civo-canvas-outline--hover"
                            style={{
                                top: hoveredRect.top,
                                left: hoveredRect.left,
                                width: hoveredRect.width,
                                height: hoveredRect.height,
                            }}
                        />
                    )}
                    {selectedRect && selectedNodeId && (
                        <div
                            className="civo-canvas-outline civo-canvas-outline--selected"
                            style={{
                                top: selectedRect.top,
                                left: selectedRect.left,
                                width: selectedRect.width,
                                height: selectedRect.height,
                            }}
                        >
                            <div className="civo-canvas-label">
                                <span>{selectedDefinition?.label ?? "Komponente"}</span>
                                <CanvasNodeActions
                                    onDelete={() => dispatch(removeNodeAction(selectedNodeId))}
                                    onDuplicate={() => dispatch(duplicateNodeAction(selectedNodeId))}
                                    onMoveUp={() => {
                                        const location = locateNode(nodes, selectedNodeId);
                                        if (location && location.index > 0) {
                                            dispatch(
                                                moveNodeAction({
                                                    nodeId: selectedNodeId,
                                                    parentId: location.parentId,
                                                    index: location.index - 1,
                                                })
                                            );
                                        }
                                    }}
                                    onMoveDown={() => {
                                        const location = locateNode(nodes, selectedNodeId);
                                        if (location && location.index < location.siblings.length - 1) {
                                            dispatch(
                                                moveNodeAction({
                                                    nodeId: selectedNodeId,
                                                    parentId: location.parentId,
                                                    index: location.index + 1,
                                                })
                                            );
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isRendering && nodes.length > 0 && !node && (
                <p className="mt-3 text-center text-xs text-[var(--civo-color-text-muted)]">Wird gerendert…</p>
            )}
            {error && <p className="mt-3 text-center text-xs text-red-700">{error}</p>}
        </div>
    );
}
