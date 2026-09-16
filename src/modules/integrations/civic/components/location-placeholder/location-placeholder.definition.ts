import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


export const locationPlaceholderPropsSchema = z.object({
    heading: z.string().default("Anfahrt"),
    address: z.string().optional(),
});

export const locationPlaceholderFields: PropField<Extract<keyof z.infer<typeof locationPlaceholderPropsSchema>, string>>[] = [
    { key: "heading", group: "content", label: "Überschrift", control: "text" },
    { key: "address", group: "content", label: "Adresse", control: "text" },
];

export const locationPlaceholderDefinition: ComponentDefinition<z.infer<typeof locationPlaceholderPropsSchema>> = {
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
    

    municipalFields: ["heading", "address"],
    municipallyEditable: true,
};
