import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


export const metricDonutPropsSchema = z.object({
    heading: z.string().default("Verteilung"),
    metricId: z.string().optional()
});

export const metricDonutFields: PropField[] = [
    { key: "heading", label: "Überschrift", control: "text" },
    { key: "metricId", label: "Metrik-ID", control: "text" }
];

export const metricDonutDefinition: ComponentDefinition = {
    type: "metricDonut",
    label: "Donut-Diagramm",
    category: "smartcity",
    description: "Stellt eine prozentuale Verteilung dar.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("metricDonut"),
        type: "metricDonut",
        props: { heading: "Verteilung" },
    }),
    propsSchema: metricDonutPropsSchema,
    fields: metricDonutFields,
    
};
