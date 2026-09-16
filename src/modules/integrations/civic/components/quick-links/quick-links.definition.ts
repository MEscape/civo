import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


export const quickLinksPropsSchema = z.object({
    heading: z.string().default("Schnellzugriff"),
    links: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
});

export const quickLinksFields: PropField[] = [
    { key: "heading", label: "Überschrift", control: "text" }
];

export const quickLinksDefinition: ComponentDefinition = {
    type: "quickLinks",
    label: "Schnellzugriff",
    category: "civic",
    description: "Liste wichtiger Links.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("quickLinks"),
        type: "quickLinks",
        props: { heading: "Schnellzugriff", links: [] },
    }),
    propsSchema: quickLinksPropsSchema,
    fields: quickLinksFields,
    
};
