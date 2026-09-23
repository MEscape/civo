import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";

export const richTextPropsSchema = z.object({
    heading: z.string().optional(),
    body: z.string().default(""),
});

export const richTextFields: PropField<Extract<keyof z.infer<typeof richTextPropsSchema>, string>>[] = [
    { key: "heading", label: "Überschrift", control: "text" },
    { key: "body", label: "Text", control: "textarea" },
];

export const richTextDefinition: ComponentDefinition<z.infer<typeof richTextPropsSchema>> = {
    type: "richText",
    label: "Text",
    category: "content",
    description: "Überschrift mit Fließtext.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("richText"),
        type: "richText",
        props: { heading: "Überschrift", body: "Text hier eingeben." },
    }),
    propsSchema: richTextPropsSchema,
    fields: richTextFields,
    municipalFields: ["body"],
    municipallyEditable: true,
};
