import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


const smartCityCategoryOptions = [
    { value: "sustainability", label: "Nachhaltigkeit" },
    { value: "mobility", label: "Mobilität" },
    { value: "energy", label: "Energie" },
    { value: "other", label: "Sonstiges" },
];

export const metricTablePropsSchema = z.object({
    heading: z.string().default("Kennzahlen im Überblick"),
    category: z.enum(["sustainability", "mobility", "energy", "other"]).optional()
});

export const metricTableFields: PropField[] = [
    { key: "heading", label: "Überschrift", control: "text" },
    { key: "category", label: "Kategorie", control: "select", options: smartCityCategoryOptions }
];

export const metricTableDefinition: ComponentDefinition = {
    type: "metricTable",
    label: "Metrik-Tabelle",
    category: "smartcity",
    description: "Kennzahlen als übersichtliche Tabelle.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("metricTable"),
        type: "metricTable",
        props: { heading: "Kennzahlen im Überblick" },
    }),
    propsSchema: metricTablePropsSchema,
    fields: metricTableFields,
    
};
