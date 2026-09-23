import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";

export const metricGaugePropsSchema = z.object({
    heading: z.string().optional(),
    metricId: z.string().optional(),
    datasetId: z.string().optional(),
});

export const metricGaugeFields: PropField<Extract<keyof z.infer<typeof metricGaugePropsSchema>, string>>[] = [
    { key: "datasetId", label: "Datensatz", control: "dataset", group: "data" },
    { key: "heading", group: "content", label: "Überschrift", control: "text" },
    { key: "metricId", group: "content", label: "Metrik-ID", control: "text" }
];

export const metricGaugeDefinition: ComponentDefinition<z.infer<typeof metricGaugePropsSchema>> = {
    type: "metricGauge",
    label: "Tacho-Diagramm (Gauge)",
    category: "smartcity",
    description: "Kennzahl auf einer Skala.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("metricGauge"),
        type: "metricGauge",
        props: { heading: "Leistung" },
    }),
    propsSchema: metricGaugePropsSchema,
    fields: metricGaugeFields,
    municipalFields: ["heading", "metricId"],
    municipallyEditable: true,
    dataBinding: { canonicalType: "SmartCityMetric" },
};
