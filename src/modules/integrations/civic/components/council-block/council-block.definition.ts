import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";

export const councilBlockPropsSchema = z.object({
    heading: z.string().default("Gemeinderat & Ausschüsse"),
    datasetId: z.string().optional(),
});

export const councilBlockFields: PropField<Extract<keyof z.infer<typeof councilBlockPropsSchema>, string>>[] = [
    { key: "datasetId", label: "Datensatz", control: "dataset", group: "data" },
    { key: "heading", group: "content", label: "Überschrift", control: "text" }
];

export const councilBlockDefinition: ComponentDefinition<z.infer<typeof councilBlockPropsSchema>> = {
    type: "councilBlock",
    label: "Gemeinderat",
    category: "civic",
    description: "Mitglieder und Ausschüsse des Gemeinderats.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("councilBlock"),
        type: "councilBlock",
        props: { heading: "Gemeinderat & Ausschüsse" },
    }),
    propsSchema: councilBlockPropsSchema,
    fields: councilBlockFields,
    municipalFields: ["heading"],
    municipallyEditable: true,
    dataBinding: { canonicalType: "CouncilBody" },
};
