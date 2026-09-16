import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


const smartCityCategoryOptions = [
    { value: "sustainability", label: "Nachhaltigkeit" },
    { value: "mobility", label: "Mobilität" },
    { value: "energy", label: "Energie" },
    { value: "other", label: "Sonstiges" },
];

export const metricChartPropsSchema = z.object({
    heading: z.string().default("Entwicklung"),
    category: z.enum(["sustainability", "mobility", "energy", "other"]).optional(),
});

export const metricChartFields: PropField<Extract<keyof z.infer<typeof metricChartPropsSchema>, string>>[] = [
    { key: "heading", group: "content", label: "Überschrift", control: "text" },
    { key: "category", group: "content", label: "Kategorie", control: "select", options: smartCityCategoryOptions },
];

export const metricChartDefinition: ComponentDefinition<z.infer<typeof metricChartPropsSchema>> = {
    type: "metricChart",
    label: "Diagramm (Basis)",
    category: "smartcity",
    description: "Einfaches Diagramm für Kennzahlen.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("metricChart"),
        type: "metricChart",
        props: { heading: "Entwicklung" },
    }),
    propsSchema: metricChartPropsSchema,
    fields: metricChartFields,
    

    municipalFields: ["heading", "category"],
    municipallyEditable: true,
};
