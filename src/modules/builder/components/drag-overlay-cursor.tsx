"use client";

import { useEffect, useRef } from "react";
import type { DragSource } from "./use-canvas-dnd";
import { tryGetComponentDefinition } from "@/modules/component-platform/domain";
import type { PageNode } from "@/modules/builder/domain/page-node";
import { flattenTree } from "@/modules/builder/domain/drop-placement";

export function DragOverlayCursor({ activeSource, nodes }: { activeSource: DragSource | null; nodes: PageNode[] }) {
    const overlayRef = useRef<HTMLDivElement>(null);

    // Get the label to display in the drag overlay
    let label = "Komponente";
    if (activeSource?.kind === "palette") {
        label = activeSource.label;
    } else if (activeSource?.kind === "node") {
        const flatNodes = flattenTree(nodes);
        const nodeEntry = flatNodes.find((entry) => entry.node.id === activeSource.nodeId);
        if (nodeEntry) {
            label = tryGetComponentDefinition(nodeEntry.node.type)?.label ?? nodeEntry.node.type;
        }
    }

    // Use a direct DOM manipulation effect for 60fps cursor tracking
    // without triggering React state updates on every pointer move
    useEffect(() => {
        if (!activeSource) return;

        function handlePointerMove(event: PointerEvent) {
            if (!overlayRef.current) return;
            // Add a small offset (12px) so the cursor doesn't completely hide the drag overlay
            overlayRef.current.style.transform = `translate(${event.clientX + 12}px, ${event.clientY + 12}px)`;
        }

        window.addEventListener("pointermove", handlePointerMove);
        return () => window.removeEventListener("pointermove", handlePointerMove);
    }, [activeSource]);

    if (!activeSource) return null;

    return (
        <div
            ref={overlayRef}
            className="fixed left-0 top-0 z-[9999] pointer-events-none rounded-token border border-border bg-surface px-3 py-1.5 text-sm font-medium text-copy shadow-lg opacity-90 transition-opacity duration-150"
            style={{ transform: "translate(-9999px, -9999px)" /* Start offscreen until first mouse move */ }}
        >
            {label}
        </div>
    );
}
