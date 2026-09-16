import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


const smartCityCategoryOptions = [
    { value: "sustainability", label: "Nachhaltigkeit" },
    { value: "mobility", label: "Mobilität" },
    { value: "energy", label: "Energie" },
    { value: "other", label: "Sonstiges" },
];

export const dashboardGridPropsSchema = z.object({
    heading: z.string().default("Smart-City-Dashboard"),
    category: z.enum(["sustainability", "mobility", "energy", "other"]).optional()
});

export const dashboardGridFields: PropField[] = [
    { key: "heading", label: "Überschrift", control: "text" },
    { key: "category", label: "Kategorie", control: "select", options: smartCityCategoryOptions }
];

export const dashboardGridDefinition: ComponentDefinition = {
    type: "dashboardGrid",
    label: "Dashboard-Raster",
    category: "smartcity",
    description: "Gemischtes Dashboard mit KPIs und Charts.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("dashboardGrid"),
        type: "dashboardGrid",
        props: { heading: "Smart-City-Dashboard" },
    }),
    propsSchema: dashboardGridPropsSchema,
    fields: dashboardGridFields,
    
};
