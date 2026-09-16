import { Copy, Trash2, ChevronUp, ChevronDown } from "@/components/ui/icons";

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
                className="rounded p-0.5 hover:bg-black/10"
            >
                <ChevronUp className="h-3 w-3" />
            </button>
            <button
                type="button"
                aria-label="Nach unten verschieben"
                onClick={onMoveDown}
                className="rounded p-0.5 hover:bg-black/10"
            >
                <ChevronDown className="h-3 w-3" />
            </button>
            <button type="button" aria-label="Duplizieren" onClick={onDuplicate} className="rounded p-0.5 hover:bg-black/10">
                <Copy className="h-3 w-3" />
            </button>
            <button type="button" aria-label="Löschen" onClick={onDelete} className="rounded p-0.5 hover:bg-black/10">
                <Trash2 className="h-3 w-3" />
            </button>
        </div>
    );
}
