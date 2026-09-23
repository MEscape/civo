import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";

export const openingHoursPropsSchema = z.object({
    heading: z.string().default("Öffnungszeiten"),
    datasetId: z.string().optional(),
});

export const openingHoursFields: PropField<Extract<keyof z.infer<typeof openingHoursPropsSchema>, string>>[] = [
    { key: "datasetId", label: "Datensatz", control: "dataset", group: "data" },
    { key: "heading", group: "content", label: "Überschrift", control: "text" }
];

export const openingHoursDefinition: ComponentDefinition<z.infer<typeof openingHoursPropsSchema>> = {
    type: "openingHours",
    label: "Öffnungszeiten",
    category: "civic",
    description: "Zeigt die generellen Öffnungszeiten.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("openingHours"),
        type: "openingHours",
        props: { heading: "Öffnungszeiten" },
    }),
    propsSchema: openingHoursPropsSchema,
    fields: openingHoursFields,
    municipalFields: ["heading"],
    municipallyEditable: true,
    dataBinding: { canonicalType: "OpeningHoursEntry" },
};
