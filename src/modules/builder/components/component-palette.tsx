"use client";

import { useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { type ComponentCategory } from "@/modules/component-platform/domain";
import { getAllComponentDefinitions } from "@/modules/component-platform/domain/registry";
import { insertNodeAction } from "@/modules/builder/application/document-slice";
import { selectEditorMode } from "@/modules/builder/application/builder-selectors";
import { hasCapability } from "@/modules/builder/domain/editor-capabilities";

const categoryLabels: Record<ComponentCategory, string> = {
    layout: "Layout",
    content: "Inhalt",
    civic: "Kommunal",
    smartcity: "Smart City",
};

const categories: ComponentCategory[] = ["layout", "content", "civic", "smartcity"];

const DRAG_ACTIVATION_DISTANCE = 4;

import type { WebsiteTheme } from "@/modules/website/domain/theme";
import { ComponentPreviewPopover } from "./component-preview-popover";

type ComponentPaletteProps = {
    onBeginDrag: (componentType: string, label: string) => void;
    onDragPosition: (clientX: number, clientY: number) => void;
    onDragEnd: () => void;
    onDragCancel: () => void;
    websiteId?: string;
    theme?: WebsiteTheme;
};

/**
 * The builder's component palette (Phase 2 spec §10–12; Phase 3 spec
 * §10). Reads exclusively from `componentDefinitions` — the same
 * registry metadata the properties panel and insertion rules use, never
 * a second hard-coded list.
 *
 * Two ways to insert a component:
 *  - Click: builds a fresh default node and appends it to the page root
 *    — the fast path for "just add something", unchanged from Phase 2.
 *  - Press-and-drag: starts a real drag session (shared with the canvas
 *    via BuilderShell's useCanvasDnd instance) so the component can be
 *    dropped directly into a specific container, e.g. a Section — the
 *    interaction the Section's own empty-state text has always promised
 *    but Phase 2 never actually implemented.
 *
 * Pointer tracking here is deliberately simple (no dnd-kit sensor):
 * the palette only ever STARTS a drag; once started, useCanvasDnd's own
 * window-level pointermove/pointerup listeners take over target
 * resolution and completion, exactly as they do for in-canvas node
 * drags.
 */
export function ComponentPalette({ onBeginDrag, onDragPosition, onDragEnd, onDragCancel, websiteId, theme }: ComponentPaletteProps) {
    const dispatch = useAppDispatch();
    const editorMode = useAppSelector(selectEditorMode);
    const canEditStructure = hasCapability(editorMode, "editStructure");
    const pointerDownRef = useRef<{ x: number; y: number; type: string; label: string } | null>(null);
    const draggingRef = useRef(false);
    const [hoverState, setHoverState] = useState<{ type: string; rect: DOMRect } | null>(null);

    // In municipality mode, only show components the municipality admin is
    // allowed to replace/insert (spec §37). In internal mode, the full
    // palette is shown and drag-to-insert is available.
    const visibleDefinitions = editorMode === "municipality"
        ? getAllComponentDefinitions().filter((d) => d.municipallyEditable)
        : getAllComponentDefinitions();

    function handlePointerDown(event: React.PointerEvent, type: string, label: string) {
        if (event.button !== 0) return;
        pointerDownRef.current = { x: event.clientX, y: event.clientY, type, label };
        draggingRef.current = false;

        function handleMove(moveEvent: PointerEvent) {
            const start = pointerDownRef.current;
            if (!start) return;
            if (!draggingRef.current) {
                const dx = moveEvent.clientX - start.x;
                const dy = moveEvent.clientY - start.y;
                if (Math.hypot(dx, dy) < DRAG_ACTIVATION_DISTANCE) return;
                draggingRef.current = true;
                setHoverState(null);
                onBeginDrag(start.type, start.label);
            }
            onDragPosition(moveEvent.clientX, moveEvent.clientY);
        }

        function handleUp() {
            if (draggingRef.current) {
                onDragEnd();
            }
            pointerDownRef.current = null;

            // Delay resetting draggingRef so the subsequent native 'click' event 
            // (which the browser fires if the drop happens on the same button) 
            // still sees it as true and correctly ignores it.
            setTimeout(() => {
                draggingRef.current = false;
            }, 0);

            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
            window.removeEventListener("pointercancel", handleCancel);
        }

        function handleCancel() {
            if (draggingRef.current) onDragCancel();
            pointerDownRef.current = null;

            setTimeout(() => {
                draggingRef.current = false;
            }, 0);

            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
            window.removeEventListener("pointercancel", handleCancel);
        }

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
        window.addEventListener("pointercancel", handleCancel);
    }

    function handleClick(type: string) {
        // A drag that actually moved is handled entirely by pointerup
        // above; this click handler only fires for a plain, un-dragged
        // click (the browser suppresses the click event after a drag that
        // called preventDefault, but pointer events don't automatically
        // do that, so we gate on draggingRef instead).
        if (draggingRef.current) return;
        const definition = getAllComponentDefinitions().find((def) => def.type === type);
        if (!definition) return;
        dispatch(insertNodeAction({ node: definition.createDefaultNode(), parentId: null }));
    }

    return (
        <div className="p-4">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--civo-color-text-muted)]">
                Komponenten
            </h2>
            {categories.map((category) => {
                const items = visibleDefinitions.filter((c) => c.category === category);
                if (items.length === 0) return null;
                return (
                    <div key={category} className="mb-5">
                        <p className="mb-2 text-xs font-medium text-[var(--civo-color-text-muted)]">
                            {categoryLabels[category]}
                        </p>
                        <div className="flex flex-col gap-1">
                            {items.map((item) => (
                                <button
                                    key={item.type}
                                    type="button"
                                    onPointerDown={canEditStructure ? (event) => handlePointerDown(event, item.type, item.label) : undefined}
                                    onClick={() => handleClick(item.type)}
                                    onPointerEnter={(e) => {
                                        if (draggingRef.current) return;
                                        setHoverState({ type: item.type, rect: e.currentTarget.getBoundingClientRect() });
                                    }}
                                    onPointerLeave={() => setHoverState(null)}
                                    className="cursor-grab rounded-[calc(var(--civo-radius)_-_2px)] px-2.5 py-2 text-left text-sm text-[var(--civo-color-text)] hover:bg-[var(--civo-color-background)] focus-visible:outline-2 focus-visible:outline-[var(--civo-color-accent)]"
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            })}
            <ComponentPreviewPopover
                hoveredType={hoverState?.type ?? null}
                anchorRect={hoverState?.rect ?? null}
                websiteId={websiteId}
                theme={theme}
            />
        </div>
    );
}
