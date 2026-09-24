/** Empty-page state (spec §34): useful starting actions, not a blank canvas. */
export function CanvasEmptyState() {
    return (
        <div className="flex min-h-96 flex-col items-center justify-center gap-2 rounded-token border border-dashed border-border text-center">
            <p className="text-sm font-medium text-copy">Diese Seite ist noch leer.</p>
            <p className="max-w-xs text-sm text-copy-muted">
                Komponente aus der linken Liste hinzufügen, um zu beginnen.
            </p>
        </div>
    );
}
