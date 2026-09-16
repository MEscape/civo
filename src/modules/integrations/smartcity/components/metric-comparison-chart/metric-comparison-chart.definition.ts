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

export const metricComparisonChartFields: PropField[] = [
    { key: "heading", label: "Überschrift", control: "text" },
    { key: "category", label: "Kategorie", control: "select", options: smartCityCategoryOptions }
];

export const metricComparisonChartDefinition: ComponentDefinition = {
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
    
};
