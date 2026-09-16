import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


export const metricDonutPropsSchema = z.object({
    heading: z.string().default("Verteilung"),
    metricId: z.string().optional()
});

export const metricDonutFields: PropField<Extract<keyof z.infer<typeof metricDonutPropsSchema>, string>>[] = [
    { key: "heading", group: "content", label: "Überschrift", control: "text" },
    { key: "metricId", group: "content", label: "Metrik-ID", control: "text" }
];

export const metricDonutDefinition: ComponentDefinition<z.infer<typeof metricDonutPropsSchema>> = {
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
    

    municipalFields: ["heading", "metricId"],
    municipallyEditable: true,
};
