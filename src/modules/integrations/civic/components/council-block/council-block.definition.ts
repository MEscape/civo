import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


export const councilBlockPropsSchema = z.object({
    heading: z.string().default("Gemeinderat & Ausschüsse")
});

export const councilBlockFields: PropField[] = [
    { key: "heading", label: "Überschrift", control: "text" }
];

export const councilBlockDefinition: ComponentDefinition = {
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
    
};
