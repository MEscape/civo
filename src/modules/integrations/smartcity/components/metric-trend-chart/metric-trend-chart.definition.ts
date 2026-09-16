import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


const smartCityCategoryOptions = [
    { value: "sustainability", label: "Nachhaltigkeit" },
    { value: "mobility", label: "Mobilität" },
    { value: "energy", label: "Energie" },
    { value: "other", label: "Sonstiges" },
];

export const metricTrendChartPropsSchema = z.object({
    heading: z.string().default("Entwicklung über Zeit"),
    metricId: z.string().optional(),
    category: z.enum(["sustainability", "mobility", "energy", "other"]).optional()
});

export const metricTrendChartFields: PropField[] = [
    { key: "heading", label: "Überschrift", control: "text" },
    { key: "metricId", label: "Metrik-ID", control: "text" },
    { key: "category", label: "Kategorie", control: "select", options: smartCityCategoryOptions }
];

export const metricTrendChartDefinition: ComponentDefinition = {
    type: "metricTrendChart",
    label: "Trend-Diagramm",
    category: "smartcity",
    description: "Historische Entwicklung einer Metrik.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("metricTrendChart"),
        type: "metricTrendChart",
        props: { heading: "Entwicklung über Zeit" },
    }),
    propsSchema: metricTrendChartPropsSchema,
    fields: metricTrendChartFields,
    
};
