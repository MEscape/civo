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
 * UI field descriptor for the schema-driven properties panel.
 */
export type PropField = {
    key: string;
    label: string;
    control: PropFieldControl;
    options?: { value: string | number; label: string }[];
    placeholder?: string;
};

export type ComponentCategory = "layout" | "content" | "civic" | "smartcity";

/**
 * The React props every registered component receives. Kept intentionally
 * generic (`props` is validated per-component via `propsSchema`, not typed
 * per-component here) — component props are validated at the leaf rather
 * than typed as a tree-wide discriminated union.
 */
export type PageComponentProps = {
    props: Record<string, unknown>;
    children?: PageNode[];
    editMode?: boolean;
};

/**
 * Full component metadata.
 */
export type ComponentDefinition = {
    type: string; // The registered component type string (e.g. "hero")
    label: string;
    category: ComponentCategory;
    description: string;
    canHaveChildren: boolean;
    acceptsChildTypes?: string[];
    createDefaultNode: () => PageNode;
    propsSchema: ZodType;
    fields: PropField[];
};
