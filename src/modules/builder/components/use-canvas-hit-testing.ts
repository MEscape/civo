"use client";

import { useEffect, useState, useCallback, type RefObject } from "react";

export type NodeRect = { top: number; left: number; width: number; height: number };

/**
 * Finds the nearest ancestor (or self) of `element` carrying a
 * `data-civo-node-id` attribute, and returns that id. This is how clicks
 * and hovers on the REAL rendered component markup (injected via
 * dangerouslySetInnerHTML — see BuilderCanvas) map back to a PageNode id,
 * without the components themselves knowing anything about the editor
 * (spec §7: editor chrome stays separate from public component markup).
 */
function findNodeId(element: Element | null): string | null {
    let current: Element | null = element;
    while (current) {
        const id = current.getAttribute("data-civo-node-id");
        if (id) return id;
        current = current.parentElement;
    }
    return null;
}

/**
 * Attaches native click/mouseover/mouseout listeners (via delegation on
 * the container) to the server-rendered, React-opaque canvas content, and
 * exposes the hovered/clicked node id plus each relevant element's
 * bounding rect (relative to the container) for drawing the selection/
 * hover outline overlay.
 */
export function useCanvasHitTesting(
    containerRef: RefObject<HTMLDivElement | null>,
    options: { onSelect: (nodeId: string | null) => void; onHover: (nodeId: string | null) => void }
) {
    const [selectedRect, setSelectedRect] = useState<NodeRect | null>(null);
    const [hoveredRect, setHoveredRect] = useState<NodeRect | null>(null);

    const measure = useCallback((nodeId: string | null): NodeRect | null => {
        const container = containerRef.current;
        if (!container || !nodeId) return null;
        const target = container.querySelector(`[data-civo-node-id="${cssEscape(nodeId)}"]`);
        if (!target) return null;
        const targetRect = target.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        return {
            top: targetRect.top - containerRect.top + container.scrollTop,
            left: targetRect.left - containerRect.left + container.scrollLeft,
            width: targetRect.width,
            height: targetRect.height,
        };
    }, [containerRef]);

    const handleClick = (event: React.MouseEvent) => {
        const nodeId = findNodeId(event.target as Element);
        options.onSelect(nodeId);
        event.preventDefault();
    };

    const handleMouseOver = (event: React.MouseEvent) => {
        const nodeId = findNodeId(event.target as Element);
        options.onHover(nodeId);
    };

    const handleMouseOut = () => {
        options.onHover(null);
    };

    return { 
        measure, 
        selectedRect, 
        setSelectedRect, 
        hoveredRect, 
        setHoveredRect,
        handlers: {
            onClickCapture: handleClick,
            onMouseOver: handleMouseOver,
            onMouseOut: handleMouseOut
        }
    };
}

function cssEscape(value: string): string {
    return value.replace(/["\\]/g, "\\$&");
}
