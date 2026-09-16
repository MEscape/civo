import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


export const locationPlaceholderPropsSchema = z.object({
    heading: z.string().default("Anfahrt"),
    address: z.string().optional(),
});

export const locationPlaceholderFields: PropField[] = [
    { key: "heading", label: "Überschrift", control: "text" },
    { key: "address", label: "Adresse", control: "text" },
];

export const locationPlaceholderDefinition: ComponentDefinition = {
    type: "locationPlaceholder",
    label: "Anfahrt",
    category: "civic",
    description: "Karten-Platzhalter mit Adresse.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("locationPlaceholder"),
        type: "locationPlaceholder",
        props: { heading: "Anfahrt" },
    }),
    propsSchema: locationPlaceholderPropsSchema,
    fields: locationPlaceholderFields,
    
};
