import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";

import { generateNodeId } from "@/modules/builder/domain/tree-operations";

export const sectionPropsSchema = z.object({
    spacing: z.enum(["compact", "comfortable", "spacious"]).default("comfortable"),
    tone: z.enum(["default", "muted"]).default("default"),
});

export const sectionFields: PropField[] = [
    {
        key: "spacing",
        label: "Abstand",
        control: "select",
        options: [
            { value: "compact", label: "Kompakt" },
            { value: "comfortable", label: "Normal" },
            { value: "spacious", label: "Großzügig" },
        ],
    },
    {
        key: "tone",
        label: "Hintergrund",
        control: "select",
        options: [
            { value: "default", label: "Standard" },
            { value: "muted", label: "Abgesetzt" },
        ],
    },
];

export const sectionDefinition: ComponentDefinition = {
    type: "section",
    label: "Section",
    category: "layout",
    description: "Container mit eigenem Abstand, kann andere Komponenten aufnehmen.",
    canHaveChildren: true,
    createDefaultNode: () => ({
        id: generateNodeId("section"),
        type: "section",
        props: { spacing: "comfortable" },
    }),
    propsSchema: sectionPropsSchema,
    fields: sectionFields,
    
};
