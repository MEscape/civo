import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


export const heroPropsSchema = z.object({
    title: z.string().default("Titel"),
    subtitle: z.string().optional(),
    imageUrl: z.string().url().optional(),
});

export const heroFields: PropField<Extract<keyof z.infer<typeof heroPropsSchema>, string>>[] = [
    { key: "title", label: "Titel", control: "text", group: "content" },
    { key: "subtitle", label: "Untertitel", control: "textarea", group: "content" },
    { key: "imageUrl", label: "Bild-URL", control: "text", placeholder: "https://...", group: "appearance" },
];

export const heroDefinition: ComponentDefinition<z.infer<typeof heroPropsSchema>> = {
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
    // Municipality admins can edit the page's hero title and subtitle
    // but not swap in a different image (that's a brand/design decision).
    municipalFields: ["title", "subtitle"],
    municipallyEditable: true,
};
