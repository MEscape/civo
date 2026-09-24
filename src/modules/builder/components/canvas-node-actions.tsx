import { Copy, Trash2, ChevronUp, ChevronDown } from "@/components/ui/icons";

/**
 * Buttons sit on the accent-colored selection label, whose color changes per
 * website. `hover:bg-accent-foreground/15` overlays the label's own
 * foreground color, so the hover state stays visible on any brand accent
 * (a fixed black wash is invisible on dark accents).
 */
const actionButtonClass =
    "flex size-6 items-center justify-center rounded-token-sm hover:bg-accent-foreground/15";

/** Contextual actions for the selected node (spec §36). */
export function CanvasNodeActions({
                                      onDelete,
                                      onDuplicate,
                                      onMoveUp,
                                      onMoveDown,
                                  }: {
    onDelete: () => void;
    onDuplicate: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
}) {
    return (
        <div className="flex items-center gap-0.5">
            <button
                type="button"
                aria-label="Nach oben verschieben"
                onClick={onMoveUp}
                className={actionButtonClass}
            >
                <ChevronUp className="size-3.5" />
            </button>
            <button
                type="button"
                aria-label="Nach unten verschieben"
                onClick={onMoveDown}
                className={actionButtonClass}
            >
                <ChevronDown className="size-3.5" />
            </button>
            <button type="button" aria-label="Duplizieren" onClick={onDuplicate} className={actionButtonClass}>
                <Copy className="size-3.5" />
            </button>
            <button type="button" aria-label="Löschen" onClick={onDelete} className={actionButtonClass}>
                <Trash2 className="size-3.5" />
            </button>
        </div>
    );
}
