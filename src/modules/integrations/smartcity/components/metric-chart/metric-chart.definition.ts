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

export const metricChartFields: PropField[] = [
    { key: "heading", label: "Überschrift", control: "text" },
    { key: "category", label: "Kategorie", control: "select", options: smartCityCategoryOptions },
];

export const metricChartDefinition: ComponentDefinition = {
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
    
};
