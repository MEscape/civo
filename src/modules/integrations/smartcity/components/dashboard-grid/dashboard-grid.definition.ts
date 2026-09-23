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
    category: z.enum(["sustainability", "mobility", "energy", "other"]).optional(),
    datasetId: z.string().optional(),
});

export const dashboardGridFields: PropField<Extract<keyof z.infer<typeof dashboardGridPropsSchema>, string>>[] = [
    { key: "datasetId", label: "Datensatz", control: "dataset", group: "data" },
    { key: "heading", group: "content", label: "Überschrift", control: "text" },
    { key: "category", group: "content", label: "Kategorie", control: "select", options: smartCityCategoryOptions }
];

export const dashboardGridDefinition: ComponentDefinition<z.infer<typeof dashboardGridPropsSchema>> = {
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
    municipalFields: ["heading", "category"],
    municipallyEditable: true,
    dataBinding: { canonicalType: "SmartCityMetric" },
};
