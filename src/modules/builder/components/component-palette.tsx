"use client";

import { useAppDispatch } from "@/store/hooks";
import { componentDefinitions, type ComponentCategory } from "@/modules/component-platform/domain";
import { insertNodeAction } from "@/modules/builder/application/document-slice";

const categoryLabels: Record<ComponentCategory, string> = {
    layout: "Layout",
    content: "Inhalt",
    civic: "Kommunal",
    smartcity: "Smart City",
};

const categories: ComponentCategory[] = ["layout", "content", "civic", "smartcity"];

/**
 * The builder's component palette (Phase 2 spec §10–12). Reads
 * exclusively from `componentDefinitions` — the same registry metadata
 * the properties panel and insertion rules use, never a second
 * hard-coded list (spec §10). Clicking an item builds a fresh, valid
 * default node via the component's own `createDefaultNode()` (so
 * inserted components never render broken/empty, spec §12) and appends
 * it to the root of the page — the minimum meaningful insertion
 * position. Inserting into a specific container (e.g. dropping "Hero"
 * inside a selected Section) is a drag-and-drop interaction, covered by
 * the canvas's own drop handling.
 */
export function ComponentPalette() {
    const dispatch = useAppDispatch();

    return (
        <div className="p-4">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--civo-color-text-muted)]">
                Komponenten
            </h2>
            {categories.map((category) => {
                const items = componentDefinitions.filter((c) => c.category === category);
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
                                    onClick={() =>
                                        dispatch(
                                            insertNodeAction({
                                                node: item.createDefaultNode(),
                                                parentId: null,
                                            })
                                        )
                                    }
                                    className="rounded-[calc(var(--civo-radius)_-_2px)] px-2.5 py-2 text-left text-sm text-[var(--civo-color-text)] hover:bg-[var(--civo-color-background)] focus-visible:outline-2 focus-visible:outline-[var(--civo-color-accent)]"
                                    title={item.description}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
