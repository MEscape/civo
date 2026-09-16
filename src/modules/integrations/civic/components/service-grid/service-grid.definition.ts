import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


const gridColumnsSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

export const serviceGridPropsSchema = z.object({
    heading: z.string().default("Online-Leistungen"),
    columns: gridColumnsSchema.default(3),
});

export const serviceGridFields: PropField[] = [
    { key: "heading", label: "Überschrift", control: "text" },
    { key: "columns", label: "Spalten", control: "columns" },
];

export const serviceGridDefinition: ComponentDefinition = {
    type: "serviceGrid",
    label: "Online-Leistungen",
    category: "civic",
    description: "Kompakte Übersicht von Dienstleistungen.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("serviceGrid"),
        type: "serviceGrid",
        props: { heading: "Online-Leistungen", columns: 3 },
    }),
    propsSchema: serviceGridPropsSchema,
    fields: serviceGridFields,
    
};
