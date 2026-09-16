import type { Rect } from "@/modules/builder/domain/drop-placement";

type DropIndicatorProps = {
    rect: (Rect & { position: "before" | "after" | "inside" }) | null;
};

/**
 * The visual drop-position feedback (Phase 3 spec §9): a thin insertion
 * line for "before"/"after", or a highlighted region for "inside" a
 * container. Purely presentational — position/size is already resolved
 * by useCanvasDnd from real measured node rects, the same way the
 * existing selection/hover outlines work (builder-canvas.tsx).
 */
export function DropIndicator({ rect }: DropIndicatorProps) {
    if (!rect) return null;

    if (rect.position === "inside") {
        return (
            <div
                className="civo-drop-indicator civo-drop-indicator--inside"
                style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
            />
        );
    }

    return (
        <div
            className="civo-drop-indicator civo-drop-indicator--line"
            style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
    );
}
