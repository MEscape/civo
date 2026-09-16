import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


const gridColumnsSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

export const eventsGridPropsSchema = z.object({
    heading: z.string().default("Termine"),
    columns: gridColumnsSchema.default(3),
    limit: z.number().min(1).max(24).default(6),
    category: z.string().optional(),
});

export const eventsGridFields: PropField[] = [
    { key: "heading", label: "Überschrift", control: "text" },
    { key: "columns", label: "Spalten", control: "columns" },
    { key: "limit", label: "Anzahl", control: "number" },
    { key: "category", label: "Kategorie", control: "text", placeholder: "z. B. Markt" },
];

export const eventsGridDefinition: ComponentDefinition = {
    type: "eventsGrid",
    label: "Veranstaltungen",
    category: "civic",
    description: "Zeigt kommende Termine an.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("eventsGrid"),
        type: "eventsGrid",
        props: { heading: "Termine", columns: 3, limit: 6 },
    }),
    propsSchema: eventsGridPropsSchema,
    fields: eventsGridFields,
    
};
