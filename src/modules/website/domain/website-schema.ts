import { z } from "zod";

/**
 * Slug rule shared by websites and pages: lowercase letters, numbers, and
 * hyphens only. Kept intentionally strict — slugs become URL segments.
 */
const slugSchema = z
    .string()
    .min(1, "Slug is required.")
    .max(80, "Slug must be 80 characters or fewer.")
    .regex(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        "Slug may only contain lowercase letters, numbers, and hyphens."
    );

export const themeInputSchema = z.object({
    primaryColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, "Primary color must be a hex value like #1F3A34."),
    secondaryColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, "Secondary color must be a hex value like #7A8B85."),
    accentColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, "Accent color must be a hex value like #C9782F."),
    headingFont: z.string().min(1).max(60),
    bodyFont: z.string().min(1).max(60),
    radius: z.enum(["none", "sm", "md", "lg"]),
    spacingScale: z.enum(["compact", "comfortable", "spacious"]),
});

export type ThemeInput = z.infer<typeof themeInputSchema>;

export const createWebsiteSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters.").max(120),
    slug: slugSchema,
    description: z.string().max(500).optional(),
    templateKey: z.enum(["municipal", "smart-city", "association"]),
});

export type CreateWebsiteInput = z.infer<typeof createWebsiteSchema>;

export const updateWebsiteSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(2).max(120).optional(),
    description: z.string().max(500).optional(),
});

export type UpdateWebsiteInput = z.infer<typeof updateWebsiteSchema>;

export const createPageSchema = z.object({
    websiteId: z.string().min(1),
    path: z
        .string()
        .max(120)
        .regex(/^$|^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$/, {
            message: "Path may only contain lowercase letters, numbers, hyphens, and slashes.",
        }),
    title: z.string().min(1, "Title is required.").max(160),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;
