import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


const gridColumnsSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

export const departmentDirectoryPropsSchema = z.object({
    heading: z.string().default("Ämter & Fachbereiche"),
    columns: gridColumnsSchema.default(2)
});

export const departmentDirectoryFields: PropField[] = [
    { key: "heading", label: "Überschrift", control: "text" },
    { key: "columns", label: "Spalten", control: "columns" }
];

export const departmentDirectoryDefinition: ComponentDefinition = {
    type: "departmentDirectory",
    label: "Ämter-Verzeichnis",
    category: "civic",
    description: "Alle Ämter und Fachbereiche.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("departmentDirectory"),
        type: "departmentDirectory",
        props: { heading: "Ämter & Fachbereiche", columns: 2 },
    }),
    propsSchema: departmentDirectoryPropsSchema,
    fields: departmentDirectoryFields,
    
};
