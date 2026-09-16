import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


const gridColumnsSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const smartCityCategoryOptions = [
    { value: "sustainability", label: "Nachhaltigkeit" },
    { value: "mobility", label: "Mobilität" },
    { value: "energy", label: "Energie" },
    { value: "other", label: "Sonstiges" },
];

export const kpiGridPropsSchema = z.object({
    heading: z.string().default("Stadt in Zahlen"),
    columns: gridColumnsSchema.default(3),
    category: z.enum(["sustainability", "mobility", "energy", "other"]).optional(),
});

export const kpiGridFields: PropField<Extract<keyof z.infer<typeof kpiGridPropsSchema>, string>>[] = [
    { key: "heading", group: "content", label: "Überschrift", control: "text" },
    { key: "columns", label: "Spalten", control: "columns" },
    { key: "category", group: "content", label: "Kategorie", control: "select", options: smartCityCategoryOptions },
];

export const kpiGridDefinition: ComponentDefinition<z.infer<typeof kpiGridPropsSchema>> = {
    type: "kpiGrid",
    label: "KPI Raster",
    category: "smartcity",
    description: "Wichtige Kennzahlen als Kacheln.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("kpiGrid"),
        type: "kpiGrid",
        props: { heading: "Stadt in Zahlen", columns: 3 },
    }),
    propsSchema: kpiGridPropsSchema,
    fields: kpiGridFields,
    

    municipalFields: ["heading", "category"],
    municipallyEditable: true,
};
