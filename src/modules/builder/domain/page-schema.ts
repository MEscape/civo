import { z } from "zod";
import type { PageNode } from "@/modules/builder/domain/page-node";

/**
 * Recursive Zod schema for PageNode.
 *
 * `type` is intentionally just `z.string()` here — the *set* of allowed
 * types is enforced separately by the component registry at render time
 * (src/domain/component-platform), not by this schema. This keeps
 * the persistence-layer schema decoupled from the current list of
 * registered components: an unknown type fails closed at render time
 * (falls back to an "unknown component" placeholder) rather than making
 * every historical PageConfig invalid the moment a component is renamed.
 *
 * `props` is validated as a plain JSON-compatible record here; individual
 * component prop shapes are validated separately, closer to the
 * component, where relevant (see component prop schemas).
 *
 * ARCHITECTURE FIX (review §E2): this file previously imported
 * `isRegisteredComponentType` from the component registry despite never
 * using it — a persistence/validation-layer file reaching into the UI
 * component tree for no active reason, which is exactly the class of
 * import the dependency rules in §I are meant to forbid. The import has
 * been removed. If component-type validation is ever deliberately added
 * to this schema in the future, that would be a considered decision to
 * revisit ADR-003 (see the architecture review), not an unused,
 * accidental coupling.
 */
const jsonPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type Json = z.infer<typeof jsonPrimitive> | { [key: string]: Json } | Json[];
const jsonValueSchema: z.ZodType<Json> = z.lazy(() =>
    z.union([jsonPrimitive, z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)])
);

export const pageNodeSchema: z.ZodType<PageNode> = z.lazy(() =>
    z.object({
        id: z.string().min(1, "Node id is required."),
        type: z.string().min(1, "Node type is required."),
        props: z.record(z.string(), jsonValueSchema),
        children: z.array(pageNodeSchema).optional(),
    })
);

export const pageConfigSchema = z
    .object({
        type: z.literal("page"),
        children: z.array(pageNodeSchema),
    })
    .superRefine((config, ctx) => {
        const ids = new Set<string>();
        const visit = (nodes: PageNode[], path: (string | number)[]) => {
            nodes.forEach((node, index) => {
                if (ids.has(node.id)) {
                    ctx.addIssue({
                        code: "custom",
                        message: `Doppelte Knoten-ID "${node.id}" in der Seitenkonfiguration gefunden.`,
                        path: [...path, index, "id"],
                    });
                }
                ids.add(node.id);
                if (node.children) visit(node.children, [...path, index, "children"]);
            });
        };
        visit(config.children, ["children"]);
    });

export type PageConfigInput = z.infer<typeof pageConfigSchema>;

export type PageConfigStatus = "DRAFT" | "PUBLISHED";

/**
 * Domain read-model for a PageConfig.
 * Isolates the presentation and application layers from Prisma dependency.
 */
export type PageConfigView = {
    id: string;
    pageId: string;
    content: unknown;
    status: PageConfigStatus;
    version: number;
    createdAt: Date;
    updatedAt: Date;
};

/**
 * Domain read-model for a Page.
 * Isolates the presentation and application layers from Prisma dependency.
 */
export type PageView = {
    id: string;
    websiteId: string;
    path: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    configs: PageConfigView[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toPageConfigView(row: any): PageConfigView {
    return {
        id: row.id,
        pageId: row.pageId,
        content: row.content,
        status: row.status as PageConfigStatus,
        version: row.version,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toPageView(row: any): PageView {
    return {
        id: row.id,
        websiteId: row.websiteId,
        path: row.path,
        title: row.title,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        configs: row.configs ? row.configs.map(toPageConfigView) : [],
    };
}
