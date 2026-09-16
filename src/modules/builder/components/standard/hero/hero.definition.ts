import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


export const heroPropsSchema = z.object({
    title: z.string().default("Titel"),
    subtitle: z.string().optional(),
    imageUrl: z.string().url().optional(),
});

export const heroFields: PropField[] = [
    { key: "title", label: "Titel", control: "text" },
    { key: "subtitle", label: "Untertitel", control: "textarea" },
    { key: "imageUrl", label: "Bild-URL", control: "text", placeholder: "https://..." },
];

export const heroDefinition: ComponentDefinition = {
    type: "hero",
    label: "Hero",
    category: "content",
    description: "Große Titelfläche mit Titel und Untertitel.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("hero"),
        type: "hero",
        props: { title: "Willkommen", subtitle: "Untertitel" },
    }),
    propsSchema: heroPropsSchema,
    fields: heroFields,
    
};
