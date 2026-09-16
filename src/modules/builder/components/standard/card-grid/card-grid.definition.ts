import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


export const cardGridPropsSchema = z.object({
    heading: z.string().optional(),
    columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(3),
    cards: z
        .array(
            z.object({
                title: z.string(),
                description: z.string().optional(),
                href: z.string().optional(),
            })
        )
        .default([]),
});

export const cardGridFields: PropField<Extract<keyof z.infer<typeof cardGridPropsSchema>, string>>[] = [
    { key: "heading", group: "content", label: "Überschrift", control: "text" },
    { key: "columns", label: "Spalten", control: "columns" },
];

export const cardGridDefinition: ComponentDefinition<z.infer<typeof cardGridPropsSchema>> = {
    type: "cardGrid",
    label: "Karten-Raster",
    category: "content",
    description: "Frei konfigurierbares Raster aus Karten.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("cardGrid"),
        type: "cardGrid",
        props: {
            heading: "Übersicht",
            columns: 3,
            cards: [
                { title: "Erste Karte", description: "Kurze Beschreibung." },
                { title: "Zweite Karte", description: "Kurze Beschreibung." },
            ],
        },
    }),
    propsSchema: cardGridPropsSchema,
    fields: cardGridFields,
    

    municipalFields: ["heading", "cards"],
    municipallyEditable: true,
};
