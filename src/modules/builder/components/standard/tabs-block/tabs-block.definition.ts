import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


export const tabsPropsSchema = z.object({
    tabs: z.array(z.object({ label: z.string(), body: z.string() })).default([]),
});

export const tabsFields: PropField[] = [];

export const tabsDefinition: ComponentDefinition = {
    type: "tabs",
    label: "Tabs",
    category: "content",
    description: "Inhalte in Reitern organisiert.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("tabs"),
        type: "tabs",
        props: {
            tabs: [{ label: "Reiter 1", body: "Inhalt des ersten Reiters." }],
        },
    }),
    propsSchema: tabsPropsSchema,
    fields: tabsFields,
    
};
