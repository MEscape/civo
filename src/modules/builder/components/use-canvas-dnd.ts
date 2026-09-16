"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { PageNode } from "@/modules/builder/domain/page-node";
import {
    flattenTree,
    resolveDropPosition,
    resolveDropTarget,
    isDescendantOf,
    type DropTarget,
    type Rect,
} from "@/modules/builder/domain/drop-placement";
import { tryGetComponentDefinition } from "@/modules/component-platform/domain";

export type { DropTarget };

/**
 * Drag source kinds. "node" is an existing canvas node being moved;
 * "palette" is a new component being inserted from the component palette
 * (spec §10 — dropping a component into a Section, not just
 * click-to-append-at-root).
 */
export type DragSource =
    | { kind: "node"; nodeId: string }
    | { kind: "palette"; componentType: string; label: string };

export type IndicatorRect = Rect & { position: "before" | "after" | "inside" };

const POINTER_ACTIVATION_DISTANCE = 4;

/**
 * Measures the on-screen rect of every `[data-civo-node-id]` element
 * within `container`, relative to the container — the same technique
 * `useCanvasHitTesting` uses for selection/hover outlines. Kept separate
 * (rather than sharing state with that hook) because DnD needs ALL node
 * rects continuously during a drag, while hit-testing only ever needs one
 * (the hovered/selected) rect at a time.
 */
function measureAllNodeRects(container: HTMLElement): Map<string, Rect> {
    const map = new Map<string, Rect>();
    const containerRect = container.getBoundingClientRect();
    container.querySelectorAll("[data-civo-node-id]").forEach((el) => {
        const id = el.getAttribute("data-civo-node-id");
        if (!id) return;
        const rect = el.getBoundingClientRect();
        map.set(id, {
            top: rect.top - containerRect.top + container.scrollTop,
            left: rect.left - containerRect.left + container.scrollLeft,
            width: rect.width,
            height: rect.height,
        });
    });
    return map;
}

/**
 * Wires real, pointer-driven drag-and-drop plus a keyboard-accessible
 * "pick up / move / drop" mode to the canvas's actual rendered DOM (the
 * `data-civo-node-id`-marked elements produced by render-nodes.tsx),
 * rather than a parallel dnd-kit-owned sortable tree the canvas doesn't
 * actually render (see the removed sortable-node-handle.tsx — its own
 * comment admitted pointer dragging never worked).
 *
 * Native pointer events are used directly instead of dnd-kit's sensors
 * because dnd-kit's collision/sortable strategies assume it owns the
 * draggable/droppable DOM nodes; here the real drop targets are opaque,
 * server-rendered component markup this hook only ever reads via
 * `data-civo-node-id`, never wraps.
 */
export function useCanvasDnd(
    nodes: PageNode[],
    containerRef: RefObject<HTMLDivElement | null>,
    onDrop: (source: DragSource, target: DropTarget) => void
) {
    const [activeSource, setActiveSource] = useState<DragSource | null>(null);
    const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
    const [dropIndicatorRect, setDropIndicatorRect] = useState<IndicatorRect | null>(null);
    /** True once a keyboard "pick up" has happened (Space/Enter on a grip handle). */
    const [keyboardActive, setKeyboardActive] = useState(false);

    const rectsRef = useRef<Map<string, Rect>>(new Map());
    // dropTargetRef/activeSourceRef mirror the state above but are written
    // to SYNCHRONOUSLY, at the same call sites as the corresponding
    // setState calls (never in a useEffect) — endDrag et al. are invoked
    // from native pointerup/keydown handlers, which can fire again before
    // React has re-rendered and flushed a `useEffect`-based mirror, so an
    // effect-synced ref could read a stale value; writing both together
    // keeps them consistent within the same synchronous event-handler
    // callstack that needs them.
    const dropTargetRef = useRef<DropTarget | null>(null);
    const activeSourceRef = useRef<DragSource | null>(null);

    const flatNodes = flattenTree(nodes);

    const resolveActiveType = (source: DragSource): string => {
        if (source.kind === "palette") return source.componentType;
        return flatNodes.find((entry) => entry.node.id === source.nodeId)?.node.type ?? "";
    };

    const computeDropTargetAtPoint = (source: DragSource, clientX: number, clientY: number): DropTarget | null => {
        const container = containerRef.current;
        if (!container) return null;

        const elementAtPoint = document.elementFromPoint(clientX, clientY);
        const nodeEl = elementAtPoint?.closest("[data-civo-node-id]") as HTMLElement | null;

        if (!nodeEl) {
            // Pointer is over empty canvas background/padding, not any
            // node. If root-level content exists, treat this as
            // "append after the last root-level node" so dropping into
            // the whitespace below the last section still works.
            const lastRoot = [...flatNodes].reverse().find((entry) => entry.parentId === null);
            if (!lastRoot) return null;
            if (source.kind === "node" && lastRoot.node.id === source.nodeId) return null;
            const activeId = source.kind === "node" ? source.nodeId : "__new-component__";
            return resolveDropTarget(nodes, activeId, resolveActiveType(source), lastRoot, "after");
        }

        const targetId = nodeEl.getAttribute("data-civo-node-id")!;
        const targetEntry = flatNodes.find((entry) => entry.node.id === targetId);
        if (!targetEntry) return null;

        // Never allow dropping a node into itself or its own
        // descendants (spec §11) — checked here so the indicator never
        // promises an operation tree-operations.moveNode would refuse.
        if (source.kind === "node") {
            if (targetEntry.node.id === source.nodeId) return null;
            if (isDescendantOf(nodes, source.nodeId, targetEntry.node.id)) return null;
        }

        const rect = rectsRef.current.get(targetId);
        if (!rect) return null;

        const targetDef = tryGetComponentDefinition(targetEntry.node.type);
        const canAcceptChildren = Boolean(targetDef?.canHaveChildren);
        const isEmpty = !targetEntry.node.children || targetEntry.node.children.length === 0;

        const position = resolveDropPosition(clientY, rect, canAcceptChildren, isEmpty);
        const activeId = source.kind === "node" ? source.nodeId : "__new-component__";
        return resolveDropTarget(nodes, activeId, resolveActiveType(source), targetEntry, position);
    };

    const updateIndicatorForTarget = (target: DropTarget | null) => {
        dropTargetRef.current = target;
        setDropTarget(target);
        if (!target) {
            setDropIndicatorRect(null);
            return;
        }
        const targetRect = rectsRef.current.get(target.targetNodeId);
        if (!targetRect) {
            setDropIndicatorRect(null);
            return;
        }
        if (target.position === "inside") {
            setDropIndicatorRect({ ...targetRect, position: "inside" });
        } else if (target.position === "before") {
            setDropIndicatorRect({
                top: targetRect.top - 2,
                left: targetRect.left,
                width: targetRect.width,
                height: 4,
                position: "before",
            });
        } else {
            setDropIndicatorRect({
                top: targetRect.top + targetRect.height - 2,
                left: targetRect.left,
                width: targetRect.width,
                height: 4,
                position: "after",
            });
        }
    };

    const beginDrag = (source: DragSource) => {
        const container = containerRef.current;
        if (container) rectsRef.current = measureAllNodeRects(container);
        activeSourceRef.current = source;
        setActiveSource(source);
    };

    const endDrag = () => {
        const source = activeSourceRef.current;
        const target = dropTargetRef.current;
        if (source && target) onDrop(source, target);
        activeSourceRef.current = null;
        dropTargetRef.current = null;
        setActiveSource(null);
        setDropTarget(null);
        setDropIndicatorRect(null);
        setKeyboardActive(false);
    };

    const cancelDrag = () => {
        activeSourceRef.current = null;
        dropTargetRef.current = null;
        setActiveSource(null);
        setDropTarget(null);
        setDropIndicatorRect(null);
        setKeyboardActive(false);
    };

    // --- Pointer-driven drag, delegated on the container (mirrors
    // useCanvasHitTesting's delegation pattern) ---
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let pointerDownAt: { x: number; y: number; nodeId: string } | null = null;
        let dragStarted = false;

        function handlePointerDown(event: PointerEvent) {
            if (event.button !== 0) return;
            const target = (event.target as Element | null)?.closest("[data-civo-node-id]") as HTMLElement | null;
            if (!target) return;
            const nodeId = target.getAttribute("data-civo-node-id");
            if (!nodeId) return;
            pointerDownAt = { x: event.clientX, y: event.clientY, nodeId };
            dragStarted = false;
        }

        function handlePointerMove(event: PointerEvent) {
            if (!pointerDownAt) return;

            if (!dragStarted) {
                const dx = event.clientX - pointerDownAt.x;
                const dy = event.clientY - pointerDownAt.y;
                if (Math.hypot(dx, dy) < POINTER_ACTIVATION_DISTANCE) return;
                dragStarted = true;
                beginDrag({ kind: "node", nodeId: pointerDownAt.nodeId });
            }

            const source = activeSourceRef.current;
            if (!source) return;
            const target = computeDropTargetAtPoint(source, event.clientX, event.clientY);
            updateIndicatorForTarget(target);
        }

        function handlePointerUp() {
            if (dragStarted) {
                endDrag();
            }
            pointerDownAt = null;
            dragStarted = false;
        }

        function handlePointerCancel() {
            if (dragStarted) cancelDrag();
            pointerDownAt = null;
            dragStarted = false;
        }

        container.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", handlePointerCancel);
        return () => {
            container.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerCancel);
        };
    }, [containerRef, beginDrag, computeDropTargetAtPoint, updateIndicatorForTarget, endDrag, cancelDrag]);

    /**
     * Keyboard drag entry point (spec §12: keyboard-accessible movement).
     * Called by a grip button's onKeyDown. Space/Enter picks up the node
     * (or, if already picked up, drops it); Arrow Up/Down step the drop
     * target to the previous/next node at the same level; Escape cancels.
     */
    const handleGripKeyDown = (nodeId: string, event: React.KeyboardEvent) => {
        const isPickupKey = event.key === " " || event.key === "Enter";
        if (!keyboardActive) {
            if (isPickupKey) {
                event.preventDefault();
                beginDrag({ kind: "node", nodeId });
                setKeyboardActive(true);
            }
            return;
        }

        if (activeSourceRef.current?.kind !== "node" || activeSourceRef.current.nodeId !== nodeId) return;

        if (isPickupKey) {
            event.preventDefault();
            endDrag();
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            cancelDrag();
            return;
        }
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            const currentTargetId = dropTargetRef.current?.targetNodeId ?? nodeId;
            const currentIndex = flatNodes.findIndex((entry) => entry.node.id === currentTargetId);
            const step = event.key === "ArrowUp" ? -1 : 1;
            const nextEntry = flatNodes[currentIndex + step];
            if (!nextEntry) return;
            if (nextEntry.node.id === nodeId) return;

            const position: "before" | "after" = step === -1 ? "before" : "after";
            if (isDescendantOf(nodes, nodeId, nextEntry.node.id)) return;
            const target = resolveDropTarget(
                nodes,
                nodeId,
                resolveActiveType({ kind: "node", nodeId }),
                nextEntry,
                position
            );
            updateIndicatorForTarget(target);
        }
    };

    /** Programmatic entry point for palette drag sources (see component-palette.tsx). */
    const beginPaletteDrag = (componentType: string, label: string) => {
        beginDrag({ kind: "palette", componentType, label });
    };

    const updatePaletteDragPosition = (clientX: number, clientY: number) => {
        const source = activeSourceRef.current;
        if (!source || source.kind !== "palette") return;
        const target = computeDropTargetAtPoint(source, clientX, clientY);
        updateIndicatorForTarget(target);
    };

    return {
        activeSource,
        dropTarget,
        dropIndicatorRect,
        keyboardActive,
        handleGripKeyDown,
        beginPaletteDrag,
        updatePaletteDragPosition,
        endDrag,
        cancelDrag,
    };
}
