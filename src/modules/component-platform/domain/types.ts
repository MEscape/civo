import type { ZodType } from "zod";

import type { PageNode } from "@/modules/builder/domain/page-node";

/**
 * Valid UI controls for the properties panel.
 */
export type PropFieldControl =
    | "text"
    | "textarea"
    | "number"
    | "select"
    | "columns"
    | "switch";

/**
 * Logical group for a PropField — rendered as distinct sections in the
 * properties panel so data configuration and appearance controls never
 * appear interleaved (spec §25, §32).
 */
export type PropFieldGroup = "content" | "appearance";

/**
 * UI field descriptor for the schema-driven properties panel.
 */
export type PropField<TKey extends string = string> = {
    key: TKey;
    label: string;
    control: PropFieldControl;
    /**
     * Optional logical group. Fields without a group are rendered together
     * in an ungrouped section (preserves backward-compat with all existing
     * component definitions that don't set a group).
     */
    group?: PropFieldGroup;
    options?: { value: string | number; label: string }[];
    placeholder?: string;
};

export type ComponentCategory = "layout" | "content" | "civic" | "smartcity";

/**
 * The React props every registered component receives. Kept intentionally
 * generic (`props` is validated per-component via `propsSchema`, not typed
 * per-component here) — component props are validated at the leaf rather
 * than typed as a tree-wide discriminated union.
 *
 * `websiteId` (Phase 3 spec §22–23) identifies which website's configured
 * data sources a data-aware component (NewsGrid, EventsGrid, ...) should
 * resolve against — see getCivicDataProvider(websiteId) /
 * getSmartCityDataProvider(websiteId). Components that don't fetch data
 * simply ignore it. It's threaded explicitly through the render tree
 * (PageRenderer -> renderPageNodes -> PageNodeRenderer -> here) rather
 * than read from ambient/module-level request state, since Server
 * Component rendering can interleave across concurrent requests and an
 * explicit parameter can't leak between them the way mutable module state
 * could.
 */
export type PageComponentProps = {
    props: Record<string, unknown>;
    children?: PageNode[];
    editMode?: boolean;
    websiteId?: string;
};

/**
 * Full component metadata.
 *
 * Takes an optional generic TProps so that fields and municipalFields
 * can be strictly typed to only allow valid keys of the component's props.
 */
export type ComponentDefinition<TProps extends Record<string, unknown> = Record<string, unknown>> = {
    type: string; // The registered component type string (e.g. "hero")
    label: string;
    category: ComponentCategory;
    description: string;
    canHaveChildren: boolean;
    acceptsChildTypes?: string[];
    createDefaultNode: () => PageNode;
    propsSchema: ZodType;
    /** All editable fields — shown in the internal builder. */
    fields: PropField<Extract<keyof TProps, string>>[];
    /**
     * Subset of `fields` that municipality admins are allowed to edit
     * (spec §36, §39). When absent, municipality mode shows no editable
     * fields for this component — content-only, non-editable in that mode.
     * Keys must match field keys in `fields`; the panel resolves them by
     * key to avoid duplicating field descriptors.
     */
    municipalFields?: Extract<keyof TProps, string>[];
    /**
     * Whether this component can appear in the municipality editor's
     * restricted component palette (spec §37).
     */
    municipallyEditable?: boolean;
};
