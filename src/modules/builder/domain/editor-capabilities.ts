/**
 * Editor capability model (Phase 3 spec §35–38).
 *
 * Capabilities describe WHAT an editor session is allowed to do —
 * distinct from authentication/authorization, which is a future concern
 * (spec §46). The same PageConfig is read by both editor modes; the
 * capability set controls which operations the UI offers and the
 * properties panel surfaces.
 *
 * This module is intentionally small: it defines the vocabulary, not an
 * engine. Both `BuilderShell` and the future municipality-editor page
 * read their capability set from `editorCapabilities[mode]` and pass it
 * down into the UI. No deep permission-checking runtime is needed for the
 * MVP — the restriction is at the UI layer, backed by the component
 * definition's `municipalFields`/`municipallyEditable` metadata.
 */

export type EditorCapability =
    | "editStructure"   // Add/remove/reorder components (DnD, palette)
    | "editContent"     // Change text/image/link content fields
    | "changeVariant"   // Change presentation variant (columns, style)
    | "changeSpacing"   // Change spacing/layout appearance fields
    | "configureData"   // Change data source / limit / category
    | "manageTheme"     // Change website theme tokens
    | "toggleVisibility"; // Hide/show components via the `visible` prop

export type EditorMode = "internal" | "municipality";

/**
 * The full capability set per editor mode.
 *
 * "internal" is the full builder — designers and developers. Every
 * capability is enabled.
 *
 * "municipality" is the restricted mode for Gemeindeverwaltung staff.
 * They can edit content and basic presentation, but cannot restructure
 * the page, change data sources, or manage the theme.
 */
export const editorCapabilities: Record<EditorMode, ReadonlySet<EditorCapability>> = {
    internal: new Set<EditorCapability>([
        "editStructure",
        "editContent",
        "changeVariant",
        "changeSpacing",
        "configureData",
        "manageTheme",
        "toggleVisibility",
    ]),
    municipality: new Set<EditorCapability>([
        "editContent",
        "changeVariant",
        "toggleVisibility",
    ]),
};

export function hasCapability(mode: EditorMode, capability: EditorCapability): boolean {
    return editorCapabilities[mode].has(capability);
}
