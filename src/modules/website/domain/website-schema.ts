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
            message: "Der Pfad darf nur Kleinbuchstaben, Zahlen, Bindestriche und Schrägstriche enthalten.",
        }),
    title: z.string().min(1, "Title is required.").max(160),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;

/**
 * Domain read-model for a Theme.
 * Isolates the presentation and application layers from Prisma dependency.
 */
export type ThemeView = {
    id: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    headingFont: string;
    bodyFont: string;
    radius: string;
    spacingScale: string;
    createdAt: Date;
    updatedAt: Date;
};

/**
 * Domain read-model for a Website.
 * Isolates the presentation and application layers from Prisma dependency.
 */
export type WebsiteView = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    templateKey: string | null;
    createdAt: Date;
    updatedAt: Date;
    theme: ThemeView | null;
};

export type ThemeRow = {
    id: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    headingFont: string;
    bodyFont: string;
    radius: string;
    spacingScale: string;
    createdAt: Date;
    updatedAt: Date;
};

export function toThemeView(row: ThemeRow): ThemeView {
    return {
        id: row.id,
        primaryColor: row.primaryColor,
        secondaryColor: row.secondaryColor,
        accentColor: row.accentColor,
        headingFont: row.headingFont,
        bodyFont: row.bodyFont,
        radius: row.radius,
        spacingScale: row.spacingScale,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

export type WebsiteRow = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    templateKey: string | null;
    createdAt: Date;
    updatedAt: Date;
    theme?: ThemeRow | null;
};

export function toWebsiteView(row: WebsiteRow): WebsiteView {
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        templateKey: row.templateKey,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        theme: row.theme ? toThemeView(row.theme) : null,
    };
}
