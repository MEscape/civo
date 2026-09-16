import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


export const openingHoursPropsSchema = z.object({
    heading: z.string().default("Öffnungszeiten"),
});

export const openingHoursFields: PropField[] = [
    { key: "heading", label: "Überschrift", control: "text" }
];

export const openingHoursDefinition: ComponentDefinition = {
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
    
};
