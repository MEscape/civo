import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


const smartCityCategoryOptions = [
    { value: "sustainability", label: "Nachhaltigkeit" },
    { value: "mobility", label: "Mobilität" },
    { value: "energy", label: "Energie" },
    { value: "other", label: "Sonstiges" },
];

export const metricComparisonChartPropsSchema = z.object({
    heading: z.string().default("Vergleich"),
    category: z.enum(["sustainability", "mobility", "energy", "other"]).optional()
});

export const metricComparisonChartFields: PropField<Extract<keyof z.infer<typeof metricComparisonChartPropsSchema>, string>>[] = [
    { key: "heading", group: "content", label: "Überschrift", control: "text" },
    { key: "category", group: "content", label: "Kategorie", control: "select", options: smartCityCategoryOptions }
];

export const metricComparisonChartDefinition: ComponentDefinition<z.infer<typeof metricComparisonChartPropsSchema>> = {
    type: "metricComparisonChart",
    label: "Vergleichs-Diagramm",
    category: "smartcity",
    description: "Vergleicht Metriken miteinander.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("metricComparisonChart"),
        type: "metricComparisonChart",
        props: { heading: "Vergleich" },
    }),
    propsSchema: metricComparisonChartPropsSchema,
    fields: metricComparisonChartFields,
    

    municipalFields: ["heading", "category"],
    municipallyEditable: true,
};
