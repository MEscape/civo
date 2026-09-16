import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


export const callToActionPropsSchema = z.object({
    heading: z.string().default("Jetzt aktiv werden"),
    body: z.string().optional(),
    buttonLabel: z.string().default("Mehr erfahren"),
    href: z.string().default("#"),
});

export const callToActionFields: PropField<Extract<keyof z.infer<typeof callToActionPropsSchema>, string>>[] = [
    { key: "heading", group: "content", label: "Überschrift", control: "text" },
    { key: "body", label: "Text", control: "textarea" },
    { key: "buttonLabel", label: "Button-Beschriftung", control: "text" },
    { key: "href", label: "Link-Ziel", control: "text", placeholder: "/leistungen" },
];

export const callToActionDefinition: ComponentDefinition<z.infer<typeof callToActionPropsSchema>> = {
    type: "callToAction",
    label: "Call-to-Action",
    category: "content",
    description: "Hervorgehobener Abschnitt mit Button.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("callToAction"),
        type: "callToAction",
        props: { heading: "Jetzt aktiv werden", buttonLabel: "Mehr erfahren", href: "#" },
    }),
    propsSchema: callToActionPropsSchema,
    fields: callToActionFields,
    

    municipalFields: ["heading", "body", "buttonLabel", "href"],
    municipallyEditable: true,
};
