import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


export const metricGaugePropsSchema = z.object({
    heading: z.string().optional(),
    metricId: z.string().optional()
});

export const metricGaugeFields: PropField[] = [
    { key: "heading", label: "Überschrift", control: "text" },
    { key: "metricId", label: "Metrik-ID", control: "text" }
];

export const metricGaugeDefinition: ComponentDefinition = {
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
    
};
