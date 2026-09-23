import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";

export const accordionPropsSchema = z.object({
    heading: z.string().optional(),
    items: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
});

export const accordionFields: PropField<Extract<keyof z.infer<typeof accordionPropsSchema>, string>>[] = [
    { key: "heading", group: "content", label: "Überschrift", control: "text" }
];

export const accordionDefinition: ComponentDefinition<z.infer<typeof accordionPropsSchema>> = {
    type: "accordion",
    label: "Akkordeon",
    category: "content",
    description: "Ein-/ausklappbare Fragen und Antworten.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("accordion"),
        type: "accordion",
        props: {
            heading: "Häufige Fragen",
            items: [{ question: "Beispiel-Frage?", answer: "Beispiel-Antwort." }],
        },
    }),
    propsSchema: accordionPropsSchema,
    fields: accordionFields,
    municipalFields: ["heading", "items"],
    municipallyEditable: true,
};
