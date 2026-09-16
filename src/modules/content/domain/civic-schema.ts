import { z } from "zod";

export const newsItemSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    slug: z.string().min(1),
    excerpt: z.string().optional(),
    content: z.string().optional(),
    imageUrl: z.string().url().optional(),
    publishedAt: z.coerce.date().optional(),
    category: z.string().optional(),
});

export const civicEventSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    location: z.string().optional(),
    category: z.string().optional(),
    imageUrl: z.string().url().optional(),
});

export const serviceSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    href: z.string().min(1),
    icon: z.string().optional(),
});

export const contactSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    role: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
});

export const openingHoursEntrySchema = z.object({
    day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
    opensAt: z.string().optional(),
    closesAt: z.string().optional(),
    closed: z.boolean().optional(),
});

export const serviceDetailSchema = serviceSchema.extend({
    category: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    department: z.string().optional(),
    processingNote: z.string().optional(),
});

export const councilMemberSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    role: z.string().optional(),
    party: z.string().optional(),
});

export const councilBodySchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    members: z.array(councilMemberSchema),
});

export const wasteTypeSchema = z.enum(["restmuell", "biomuell", "papier", "gelberSack", "sperrmuell"]);

export const wasteCollectionEntrySchema = z.object({
    id: z.string().min(1),
    date: z.coerce.date(),
    wasteType: wasteTypeSchema,
    district: z.string().optional(),
});

export const alertSeveritySchema = z.enum(["info", "warning", "urgent"]);

export const alertSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    message: z.string().optional(),
    severity: alertSeveritySchema,
    href: z.string().optional(),
    active: z.boolean(),
});

export const departmentSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    href: z.string().optional(),
    contacts: z.array(contactSchema),
});

export const newsItemListSchema = z.array(newsItemSchema);
export const civicEventListSchema = z.array(civicEventSchema);
export const serviceListSchema = z.array(serviceSchema);
export const contactListSchema = z.array(contactSchema);
export const openingHoursListSchema = z.array(openingHoursEntrySchema);
export const serviceDetailListSchema = z.array(serviceDetailSchema);
export const councilBodyListSchema = z.array(councilBodySchema);
export const wasteCollectionEntryListSchema = z.array(wasteCollectionEntrySchema);
export const alertListSchema = z.array(alertSchema);
export const departmentListSchema = z.array(departmentSchema);
