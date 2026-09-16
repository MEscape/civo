import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


export const wasteCalendarPropsSchema = z.object({
    heading: z.string().default("Abfuhrkalender"),
    district: z.string().optional(),
    limit: z.number().default(10)
});

export const wasteCalendarFields: PropField[] = [
    { key: "heading", label: "Überschrift", control: "text" },
    { key: "district", label: "Bezirk", control: "text" },
    { key: "limit", label: "Anzahl", control: "number" }
];

export const wasteCalendarDefinition: ComponentDefinition = {
    type: "wasteCalendar",
    label: "Abfuhrkalender",
    category: "civic",
    description: "Nächste Müllabholungen.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("wasteCalendar"),
        type: "wasteCalendar",
        props: { heading: "Abfuhrkalender", limit: 10 },
    }),
    propsSchema: wasteCalendarPropsSchema,
    fields: wasteCalendarFields,
    
};
