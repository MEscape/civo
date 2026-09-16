import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


export const contactCardPropsSchema = z.object({
    heading: z.string().default("Kontakt"),
});

export const contactCardFields: PropField[] = [
    { key: "heading", label: "Überschrift", control: "text" }
];

export const contactCardDefinition: ComponentDefinition = {
    type: "contactCard",
    label: "Kontakte",
    category: "civic",
    description: "Ansprechpartner und Kontaktdaten.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("contactCard"),
        type: "contactCard",
        props: { heading: "Kontakt" },
    }),
    propsSchema: contactCardPropsSchema,
    fields: contactCardFields,
    
};
