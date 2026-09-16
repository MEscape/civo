/** Empty-page state (spec §34): useful starting actions, not a blank canvas. */
export function CanvasEmptyState() {
    return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 rounded-[var(--civo-radius)] border border-dashed border-[var(--civo-color-border)] text-center">
            <p className="text-sm font-medium text-[var(--civo-color-text)]">Diese Seite ist noch leer.</p>
            <p className="max-w-xs text-sm text-[var(--civo-color-text-muted)]">
                Komponente aus der linken Liste hinzufügen, um zu beginnen.
            </p>
        </div>
    );
}
