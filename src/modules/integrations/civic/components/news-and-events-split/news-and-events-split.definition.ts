import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";

export const newsAndEventsSplitPropsSchema = z.object({
    heading: z.string().default("Aktuelles & Termine"),
    newsLimit: z.number().default(4),
    eventsDatasetId: z.string().optional(),
    newsDatasetId: z.string().optional(),
    eventsLimit: z.number().default(4)
});

export const newsAndEventsSplitFields: PropField<Extract<keyof z.infer<typeof newsAndEventsSplitPropsSchema>, string>>[] = [
    { key: "eventsDatasetId", label: "Termine Datensatz", control: "dataset", group: "data", canonicalType: "Event" },
    { key: "newsDatasetId", label: "News Datensatz", control: "dataset", group: "data", canonicalType: "NewsItem" },
    { key: "heading", label: "Überschrift", control: "text" },
    { key: "newsLimit", label: "Anzahl Aktuelles", control: "number" },
    { key: "eventsLimit", label: "Anzahl Termine", control: "number" }
];

export const newsAndEventsSplitDefinition: ComponentDefinition<z.infer<typeof newsAndEventsSplitPropsSchema>> = {
    type: "newsAndEventsSplit",
    label: "News & Events Split",
    category: "civic",
    description: "Aktuelles und Termine nebeneinander.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("newsAndEventsSplit"),
        type: "newsAndEventsSplit",
        props: { heading: "Aktuelles & Termine", newsLimit: 4, eventsLimit: 4 },
    }),
    propsSchema: newsAndEventsSplitPropsSchema,
    fields: newsAndEventsSplitFields,
    municipalFields: ["heading", "newsLimit", "eventsLimit"],
    municipallyEditable: true,
};
