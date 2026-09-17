"use client";

import { useEffect, useState, type RefObject } from "react";
import { useAppDispatch } from "@/store/hooks";
import { removeNodeAction, duplicateNodeAction, moveNodeAction } from "@/modules/builder/application/document-slice";
import { getComponentDefinition } from "@/modules/component-platform/domain";
import type { PageNode } from "@/modules/builder/domain/page-node";
import { locateNode } from "@/modules/builder/domain/tree-operations";
import { flattenTree } from "@/modules/builder/domain/drop-placement";
import { useCanvasRender } from "./use-canvas-render";
import { useCanvasHitTesting } from "./use-canvas-hit-testing";
import type { useCanvasDnd } from "./use-canvas-dnd";
import { CanvasDragHandles } from "./canvas-drag-handles";
import { DropIndicator } from "./drop-indicator";
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
    containerRef: RefObject<HTMLDivElement | null>;
    dnd: ReturnType<typeof useCanvasDnd>;
    websiteId?: string;
};

const viewportWidths: Record<BuilderCanvasProps["viewport"], string> = {
    desktop: "100%",
    tablet: "768px",
    mobile: "390px",
};

/**
 * The builder canvas (Phase 3 spec §5–16).
 *
 * Drag-and-drop is wired directly to the real, server-rendered DOM (every
 * node in edit mode carries `data-civo-node-id` — see render-nodes.tsx)
 * via `useCanvasDnd`, rather than a separate dnd-kit-owned sortable tree.
 * The previous implementation built such a parallel tree entirely inside
 * an `.sr-only` container that was never actually visible or reachable by
 * pointer interaction — see the removed sortable-node-handle.tsx, whose
 * own comment admitted as much. Selection/hover hit-testing
 * (useCanvasHitTesting) already solved "map a click on real markup back
 * to a node id"; useCanvasDnd reuses the exact same `data-civo-node-id`
 * delegation technique for drag interactions.
 *
 * `dnd` and `containerRef` are owned by BuilderShell (not this
 * component) because the component palette — a sibling, not a
 * descendant — also needs to drive the same drag session when starting a
 * drag from a palette item (spec §10).
 */
export function BuilderCanvas({ nodes, selectedNodeId, onSelect, viewport, theme, containerRef, dnd, websiteId }: BuilderCanvasProps) {
    const dispatch = useAppDispatch();
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    const { node, isRendering, error } = useCanvasRender(nodes, websiteId);
    const { measure, selectedRect, setSelectedRect, hoveredRect, setHoveredRect, handlers } = useCanvasHitTesting(
        containerRef,
        {
            onSelect,
            onHover: setHoveredNodeId,
        }
    );

    useEffect(() => {
        setSelectedRect(measure(selectedNodeId));
    }, [selectedNodeId, node, viewport, measure, setSelectedRect]);

    useEffect(() => {
        setHoveredRect(hoveredNodeId && hoveredNodeId !== selectedNodeId ? measure(hoveredNodeId) : null);
    }, [hoveredNodeId, selectedNodeId, node, viewport, measure, setHoveredRect]);

    // The viewport switcher (desktop/tablet/mobile) animates the canvas's
    // max-width over 150ms (see the outer div's `transition-[max-width]`
    // below), so the two effects above — which re-measure the instant
    // `viewport` changes — capture the selection/hover overlay's rect
    // before the resize animation has actually finished, leaving the
    // overlay box at a stale position/size relative to the now-resized
    // content. Re-measuring again on `transitionend` catches the final,
    // settled geometry. Listened on the same element `measure` reads
    // from (containerRef), which sits inside the transitioning ancestor
    // so the bubbling `transitionend` event still reaches it.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        function handleTransitionEnd(event: TransitionEvent) {
            if (event.propertyName !== "max-width") return;
            setSelectedRect(measure(selectedNodeId));
            setHoveredRect(hoveredNodeId && hoveredNodeId !== selectedNodeId ? measure(hoveredNodeId) : null);
        }

        container.addEventListener("transitionend", handleTransitionEnd);
        return () => container.removeEventListener("transitionend", handleTransitionEnd);
    }, [containerRef, selectedNodeId, hoveredNodeId, measure, setSelectedRect, setHoveredRect]);

    const { activeSource, dropIndicatorRect, keyboardActive, handleGripKeyDown } = dnd;

    const flatNodesForHandles = flattenTree(nodes);
    const selectedDefinition = selectedNodeId ? tryFindDefinition(nodes, selectedNodeId) : undefined;
    const hoveredDefinition = hoveredNodeId ? tryFindDefinition(nodes, hoveredNodeId) : undefined;

    if (nodes.length === 0 && !isRendering) {
        // We still need to render the canvas shell so the empty state is a valid drop target
    }

    return (
        <div className="mx-auto transition-[max-width] duration-150" style={{ maxWidth: viewportWidths[viewport] }}>
            <div className="civo-canvas rounded-[var(--civo-radius)] border border-[var(--civo-color-border)] bg-[var(--civo-color-background)]">
                <div
                    ref={containerRef}
                    className="civo-canvas-content"
                    data-civo-dragging={activeSource ? "true" : "false"}
                    {...handlers}
                >
                    {nodes.length === 0 ? (
                        <CanvasEmptyState />
                    ) : theme ? (
                        <ThemeProvider theme={theme}>{node}</ThemeProvider>
                    ) : (
                        node
                    )}
                </div>

                <div className="civo-canvas-overlay">
                    {hoveredRect && hoveredNodeId && (
                        <div
                            className="civo-canvas-outline civo-canvas-outline--hover"
                            style={{
                                top: hoveredRect.top,
                                left: hoveredRect.left,
                                width: hoveredRect.width,
                                height: hoveredRect.height,
                            }}
                        >
                            <div className="civo-canvas-label civo-canvas-label--hover">
                                <span>{hoveredDefinition?.label ?? "Komponente"}</span>
                            </div>
                        </div>
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

                    <CanvasDragHandles
                        flatNodes={flatNodesForHandles}
                        getRect={(nodeId) => measure(nodeId)}
                        getLabel={(type) => getComponentDefinition(type)?.label ?? type}
                        activeNodeId={activeSource?.kind === "node" ? activeSource.nodeId : null}
                        keyboardActive={keyboardActive}
                        onKeyDown={handleGripKeyDown}
                    />

                    <DropIndicator rect={dropIndicatorRect} />
                </div>
            </div>

            {isRendering && nodes.length > 0 && !node && (
                <p className="mt-3 text-center text-xs text-[var(--civo-color-text-muted)]">Wird gerendert…</p>
            )}
            {error && <p className="mt-3 text-center text-xs text-red-700">{error}</p>}
        </div>
    );
}

function tryFindDefinition(nodes: PageNode[], nodeId: string) {
    const location = locateNode(nodes, nodeId);
    if (!location) return undefined;
    return getComponentDefinition(location.node.type);
}
