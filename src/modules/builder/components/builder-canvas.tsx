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
import { useAppSelector } from "@/store/hooks";
import { selectEditorMode } from "@/modules/builder/application/builder-selectors";
import { hasCapability } from "@/modules/builder/domain/editor-capabilities";
import "./builder-canvas.css";

type BuilderCanvasProps = {
    nodes: PageNode[];
    selectedNodeId: string | null;
    onSelect: (id: string | null) => void;
    viewport: "desktop" | "tablet" | "mobile";
    theme?: WebsiteTheme;
    containerRef: RefObject<HTMLDivElement | null>;
    dnd: ReturnType<typeof useCanvasDnd>;
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
export function BuilderCanvas({ nodes, selectedNodeId, onSelect, viewport, theme, containerRef, dnd }: BuilderCanvasProps) {
    const dispatch = useAppDispatch();
    const editorMode = useAppSelector(selectEditorMode);
    const canEditStructure = hasCapability(editorMode, "editStructure");
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    const { node, isRendering, error } = useCanvasRender(nodes);
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

    // The overlay boxes are positioned from measurements of the rendered
    // content, so they go stale whenever that content changes size without
    // the selection changing: the viewport switcher animates the canvas's
    // max-width over 150ms (see the outer div's `transition-[max-width]`),
    // the browser window resizes, images finish loading. The effects above
    // measure once per change of their inputs, which is too early for an
    // animation. A ResizeObserver reports every actual size change, including
    // each frame of the transition, so the overlay follows the content.
    //
    // Not `transitionend`: that fires on the element that transitions and
    // bubbles UP to its ancestors. `containerRef` is a descendant of the
    // transitioning element, so it never receives it in a browser.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver(() => {
            setSelectedRect(measure(selectedNodeId));
            setHoveredRect(hoveredNodeId && hoveredNodeId !== selectedNodeId ? measure(hoveredNodeId) : null);
        });
        observer.observe(container);
        return () => observer.disconnect();
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
            <div className="civo-canvas rounded-token border border-border bg-canvas">
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
                                {canEditStructure && (
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
                                )}
                            </div>
                        </div>
                    )}

                    {canEditStructure && (
                        <CanvasDragHandles
                            flatNodes={flatNodesForHandles}
                            getRect={(nodeId) => measure(nodeId)}
                            getLabel={(type) => getComponentDefinition(type)?.label ?? type}
                            activeNodeId={activeSource?.kind === "node" ? activeSource.nodeId : null}
                            keyboardActive={keyboardActive}
                            onKeyDown={handleGripKeyDown}
                        />
                    )}

                    <DropIndicator rect={dropIndicatorRect} />
                </div>
            </div>

            {isRendering && nodes.length > 0 && !node && (
                <p className="mt-3 text-center text-xs text-copy-muted">Wird gerendert…</p>
            )}
            {error && <p className="mt-3 text-center text-xs text-danger">{error}</p>}
        </div>
    );
}

function tryFindDefinition(nodes: PageNode[], nodeId: string) {
    const location = locateNode(nodes, nodeId);
    if (!location) return undefined;
    return getComponentDefinition(location.node.type);
}
