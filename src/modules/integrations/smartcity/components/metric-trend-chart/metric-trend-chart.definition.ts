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
    category: z.enum(["sustainability", "mobility", "energy", "other"]).optional(),
    datasetId: z.string().optional(),
});

export const metricTrendChartFields: PropField<Extract<keyof z.infer<typeof metricTrendChartPropsSchema>, string>>[] = [
    { key: "datasetId", label: "Datensatz", control: "dataset", group: "data" },
    { key: "heading", group: "content", label: "Überschrift", control: "text" },
    { key: "metricId", group: "content", label: "Metrik-ID", control: "text" },
    { key: "category", group: "content", label: "Kategorie", control: "select", options: smartCityCategoryOptions }
];

export const metricTrendChartDefinition: ComponentDefinition<z.infer<typeof metricTrendChartPropsSchema>> = {
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
    municipalFields: ["heading", "metricId", "category"],
    municipallyEditable: true,
    dataBinding: { canonicalType: "SmartCityMetric" },
};
