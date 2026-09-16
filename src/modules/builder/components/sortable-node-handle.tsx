"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * A visually-hidden (`.sr-only`) sortable list item. dnd-kit needs a
 * real, React-owned DOM node per sortable id to track drag state and
 * keyboard reordering (spec §13: "keyboard-accessible drag operations
 * where supported") — but the canvas's visible pixels always come from
 * the injected server-rendered HTML (see builder-canvas.tsx), never from
 * this element. Screen readers get an operable, labeled reorder control;
 * pointer users reorder via the selected node's contextual up/down
 * actions (spec §36), which call the same moveNodeAction this handle
 * would.
 */
export function SortableNodeHandle({ id, label }: { id: string; label: string }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    return (
        <div
            ref={setNodeRef}
    style={{ transform: CSS.Transform.toString(transform), transition }}
    className="sr-only"
    aria-label={`${label} verschieben`}
    {...attributes}
    {...listeners}
    />
);
}
