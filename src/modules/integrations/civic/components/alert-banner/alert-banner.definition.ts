import { z } from "zod";
import type { ComponentDefinition, PropField } from "@/modules/component-platform/domain/types";
import { generateNodeId } from "@/modules/builder/domain/tree-operations";


export const alertBannerPropsSchema = z.object({
    heading: z.string().optional(),
    activeOnly: z.boolean().default(true),
    limit: z.number().default(3),
});

export const alertBannerFields: PropField<Extract<keyof z.infer<typeof alertBannerPropsSchema>, string>>[] = [
    { key: "heading", label: "Überschrift", control: "text" },
    { key: "activeOnly", label: "Nur Aktive", control: "switch" },
    { key: "limit", label: "Anzahl", control: "number" }
];

export const alertBannerDefinition: ComponentDefinition<z.infer<typeof alertBannerPropsSchema>> = {
    type: "alertBanner",
    label: "Bekanntmachungen",
    category: "civic",
    description: "Kritische Meldungen und Warnungen.",
    canHaveChildren: false,
    createDefaultNode: () => ({
        id: generateNodeId("alertBanner"),
        type: "alertBanner",
        props: { activeOnly: true, limit: 3 },
    }),
    propsSchema: alertBannerPropsSchema,
    fields: alertBannerFields,
    

    municipalFields: ["heading", "limit"],
    municipallyEditable: true,
};
