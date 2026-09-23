import type { ZodType } from "zod";
import type { PageNode } from "@/modules/builder/domain/page-node";
import type { CanonicalType } from "@/modules/data-sources/domain/dataset-schema";

/**
 * Valid UI controls for the properties panel.
 *
 * "dataset" is the data-binding control: renders a searchable combobox
 * populated by datasets compatible with the component's declared
 * dataBinding.canonicalType (Phase 3.5).
 */
export type PropFieldControl =
    | "text"
    | "textarea"
    | "number"
    | "select"
    | "columns"
    | "switch"
    | "dataset";

/**
 * Logical group for a PropField — rendered as distinct sections in the
 * properties panel.
 *
 * "data"       — Data binding (dataset selector). Rendered first.
 * "content"    — Textual / editorial content.
 * "appearance" — Layout and visual presentation.
 *
 * Fields without a group are rendered in an ungrouped section after "content".
 */
export type PropFieldGroup = "data" | "content" | "appearance";

/**
 * UI field descriptor for the schema-driven properties panel.
 */
export type PropField<TKey extends string = string> = {
    key: TKey;
    label: string;
    control: PropFieldControl;
    /**
     * Optional logical group. Fields without a group are rendered together
     * after the declared groups.
     */
    group?: PropFieldGroup;
    options?: { value: string | number; label: string }[];
    placeholder?: string;
    /** For "dataset" controls: which CanonicalType to filter the selector by. */
    canonicalType?: CanonicalType;
};

export type ComponentCategory = "layout" | "content" | "civic" | "smartcity";

/**
 * The React props every registered component receives. Kept intentionally
 * generic (`props` is validated per-component via `propsSchema`, not typed
 * per-component here) — component props are validated at the leaf rather
 * than typed as a tree-wide discriminated union.
 *
 * `websiteId` identifies which website is being rendered — used for routing,
 * analytics, and as a fallback context. Data-aware components resolve their
 * data via `props.datasetId` (Phase 3.5), not via `websiteId` directly.
 *
 * Both are threaded explicitly through the render tree rather than read from
 * ambient/module-level request state, since Server Component rendering can
 * interleave across concurrent requests and an explicit parameter can't leak
 * between them the way mutable module state could.
 */
export type PageComponentProps = {
    props: Record<string, unknown>;
    children?: PageNode[];
    editMode?: boolean;
    websiteId?: string;
};

/**
 * Declares that a component consumes a specific canonical data type.
 * Used by the dataset selector to filter compatible datasets and by the
 * settings UI to show usage counts per dataset.
 */
export type ComponentDataBinding = {
    /** Which canonical type this component's primary dataset must expose. */
    canonicalType: CanonicalType;
};

/**
 * Full component metadata.
 *
 * Takes an optional generic TProps so that fields and municipalFields
 * can be strictly typed to only allow valid keys of the component's props.
 */
export type ComponentDefinition<TProps extends Record<string, unknown> = any> = {
    type: string; // The registered component type string (e.g. "hero")
    label: string;
    category: ComponentCategory;
    description: string;
    canHaveChildren: boolean;
    acceptsChildTypes?: string[];
    createDefaultNode: () => PageNode;
    propsSchema: ZodType;
    /** All editable fields — shown in the internal builder. */
    fields: readonly PropField<Extract<keyof TProps, string>>[];
    /**
     * Subset of `fields` that municipality admins are allowed to edit
     * (spec §36, §39). When absent, municipality mode shows no editable
     * fields for this component — content-only, non-editable in that mode.
     * Keys must match field keys in `fields`; the panel resolves them by
     * key to avoid duplicating field descriptors.
     */
    municipalFields?: readonly Extract<keyof TProps, string>[];
    /**
     * Whether this component can appear in the municipality editor's
     * restricted component palette (spec §37).
     */
    municipallyEditable?: boolean;
    /**
     * Declares which canonical data type this component consumes (Phase 3.5).
     * Required on any component with a "dataset" control field.
     * Absent on layout/content components that don't fetch external data.
     */
    dataBinding?: ComponentDataBinding;
};
