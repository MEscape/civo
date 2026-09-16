import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


const gridColumnsSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

export const newsGridPropsSchema = z.object({
    heading: z.string().default("Aktuelles"),
    columns: gridColumnsSchema.default(3),
    limit: z.number().min(1).max(24).default(6),
    category: z.string().optional(),
});

export const newsGridFields: PropField<Extract<keyof z.infer<typeof newsGridPropsSchema>, string>>[] = [
    { key: "heading", label: "Überschrift", control: "text", group: "content" },
    { key: "limit", label: "Anzahl", control: "number", group: "content" },
    { key: "category", label: "Kategorie", control: "text", placeholder: "z. B. Mobilität", group: "content" },
    { key: "columns", label: "Spalten", control: "columns", group: "appearance" },
];

export const newsGridDefinition: ComponentDefinition<z.infer<typeof newsGridPropsSchema>> = {
    type: "newsGrid",
    label: "Aktuelles",
    category: "civic",
    description: "Zeigt die neuesten Nachrichten an.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("newsGrid"),
        type: "newsGrid",
        props: { heading: "Aktuelles", columns: 3, limit: 6 },
    }),
    propsSchema: newsGridPropsSchema,
    fields: newsGridFields,
    // Municipality admins can set the heading and filter by category;
    // they cannot change the column count (that's the designer's layout).
    municipalFields: ["heading", "limit", "category"],
    municipallyEditable: true,
};
