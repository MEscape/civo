import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


export const serviceFinderPropsSchema = z.object({
    heading: z.string().default("Leistungen finden"),
    description: z.string().optional(),
    placeholder: z.string().default("Leistung suchen…"),
    initialCategory: z.string().optional(),
});

export const serviceFinderFields: PropField<Extract<keyof z.infer<typeof serviceFinderPropsSchema>, string>>[] = [
    { key: "heading", group: "content", label: "Überschrift", control: "text" },
    { key: "description", label: "Beschreibung", control: "textarea" },
    { key: "placeholder", group: "content", label: "Platzhalter", control: "text" },
    { key: "initialCategory", label: "Start-Kategorie", control: "text" }
];

export const serviceFinderDefinition: ComponentDefinition<z.infer<typeof serviceFinderPropsSchema>> = {
    type: "serviceFinder",
    label: "Leistungs-Suche",
    category: "civic",
    description: "Interaktive Suche für alle Dienstleistungen.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("serviceFinder"),
        type: "serviceFinder",
        props: { heading: "Leistungen finden", placeholder: "Leistung suchen…" },
    }),
    propsSchema: serviceFinderPropsSchema,
    fields: serviceFinderFields,
    

    municipalFields: ["heading", "placeholder"],
    municipallyEditable: true,
};
