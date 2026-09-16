import { describe, it, expect } from "vitest";
import {
    themeInputSchema,
    createWebsiteSchema,
    updateWebsiteSchema,
    createPageSchema,
} from "@/modules/website/domain/website-schema";

/**
 * Added per architecture review §P: website-schema.ts had no dedicated
 * test file despite containing several regex-based validations (slug,
 * hex colors, page path) — exactly the kind of logic that silently
 * breaks on edge cases without a test pinning the intended behavior.
 */

describe("createWebsiteSchema: slug", () => {
    it("accepts a simple lowercase slug", () => {
        expect(createWebsiteSchema.safeParse(validWebsite({ slug: "musterstadt" })).success).toBe(true);
    });

    it("accepts a slug with numbers and internal hyphens", () => {
        expect(createWebsiteSchema.safeParse(validWebsite({ slug: "bad-orb-2027" })).success).toBe(true);
    });

    it("rejects an empty slug", () => {
        expect(createWebsiteSchema.safeParse(validWebsite({ slug: "" })).success).toBe(false);
    });

    it("rejects uppercase letters", () => {
        expect(createWebsiteSchema.safeParse(validWebsite({ slug: "Musterstadt" })).success).toBe(false);
    });

    it("rejects a leading hyphen", () => {
        expect(createWebsiteSchema.safeParse(validWebsite({ slug: "-musterstadt" })).success).toBe(false);
    });

    it("rejects a trailing hyphen", () => {
        expect(createWebsiteSchema.safeParse(validWebsite({ slug: "musterstadt-" })).success).toBe(false);
    });

    it("rejects consecutive hyphens", () => {
        expect(createWebsiteSchema.safeParse(validWebsite({ slug: "muster--stadt" })).success).toBe(false);
    });

    it("rejects whitespace", () => {
        expect(createWebsiteSchema.safeParse(validWebsite({ slug: "muster stadt" })).success).toBe(false);
    });

    it("rejects unicode/umlaut characters", () => {
        expect(createWebsiteSchema.safeParse(validWebsite({ slug: "müsterstadt" })).success).toBe(false);
    });

    it("rejects a slug over 80 characters", () => {
        const long = "a".repeat(81);
        expect(createWebsiteSchema.safeParse(validWebsite({ slug: long })).success).toBe(false);
    });

    it("accepts a slug at exactly 80 characters", () => {
        const exact = "a".repeat(80);
        expect(createWebsiteSchema.safeParse(validWebsite({ slug: exact })).success).toBe(true);
    });
});

describe("createWebsiteSchema: name and templateKey", () => {
    it("rejects a name under 2 characters", () => {
        expect(createWebsiteSchema.safeParse(validWebsite({ name: "A" })).success).toBe(false);
    });

    it("rejects an unknown templateKey", () => {
        const result = createWebsiteSchema.safeParse({
            ...validWebsite({}),
            templateKey: "not-a-real-template",
        });
        expect(result.success).toBe(false);
    });

    it("accepts an optional description", () => {
        expect(createWebsiteSchema.safeParse(validWebsite({ description: "Eine Beschreibung." })).success).toBe(
            true
        );
    });

    it("rejects a description over 500 characters", () => {
        expect(createWebsiteSchema.safeParse(validWebsite({ description: "a".repeat(501) })).success).toBe(
            false
        );
    });
});

describe("updateWebsiteSchema", () => {
    it("accepts an id with no other fields (partial update)", () => {
        expect(updateWebsiteSchema.safeParse({ id: "website-1" }).success).toBe(true);
    });

    it("rejects a missing id", () => {
        expect(updateWebsiteSchema.safeParse({ name: "Neuer Name" }).success).toBe(false);
    });
});

describe("themeInputSchema: hex colors", () => {
    const validTheme = () => ({
        primaryColor: "#1F3A34",
        secondaryColor: "#7A8B85",
        accentColor: "#C9782F",
        headingFont: "Source Serif 4",
        bodyFont: "Inter",
        radius: "md" as const,
        spacingScale: "comfortable" as const,
    });

    it("accepts well-formed 6-digit hex colors", () => {
        expect(themeInputSchema.safeParse(validTheme()).success).toBe(true);
    });

    it("rejects a 3-digit shorthand hex color", () => {
        expect(themeInputSchema.safeParse({ ...validTheme(), primaryColor: "#F00" }).success).toBe(false);
    });

    it("rejects a hex color missing the #", () => {
        expect(themeInputSchema.safeParse({ ...validTheme(), primaryColor: "1F3A34" }).success).toBe(false);
    });

    it("rejects a named CSS color", () => {
        expect(themeInputSchema.safeParse({ ...validTheme(), primaryColor: "forestgreen" }).success).toBe(
            false
        );
    });

    it("rejects an invalid radius enum value", () => {
        expect(themeInputSchema.safeParse({ ...validTheme(), radius: "extra-large" }).success).toBe(false);
    });

    it("rejects an invalid spacingScale enum value", () => {
        expect(
            themeInputSchema.safeParse({ ...validTheme(), spacingScale: "gigantic" }).success
        ).toBe(false);
    });

    it("partial() allows updating a single field, per themeInputSchema.partial() usage in websiteService", () => {
        const result = themeInputSchema.partial().safeParse({ primaryColor: "#000000" });
        expect(result.success).toBe(true);
    });
});

describe("createPageSchema: path", () => {
    const base = { websiteId: "website-1", title: "Startseite" };

    it("accepts an empty path (home page)", () => {
        expect(createPageSchema.safeParse({ ...base, path: "" }).success).toBe(true);
    });

    it("accepts a single-segment path", () => {
        expect(createPageSchema.safeParse({ ...base, path: "leistungen" }).success).toBe(true);
    });

    it("accepts a multi-segment path", () => {
        expect(
            createPageSchema.safeParse({ ...base, path: "leistungen/personalausweis" }).success
        ).toBe(true);
    });

    it("rejects a path with uppercase letters", () => {
        expect(createPageSchema.safeParse({ ...base, path: "Leistungen" }).success).toBe(false);
    });

    it("rejects a path with a leading slash", () => {
        expect(createPageSchema.safeParse({ ...base, path: "/leistungen" }).success).toBe(false);
    });

    it("rejects a path with a trailing slash", () => {
        expect(createPageSchema.safeParse({ ...base, path: "leistungen/" }).success).toBe(false);
    });

    it("rejects a path over 120 characters", () => {
        expect(createPageSchema.safeParse({ ...base, path: "a".repeat(121) }).success).toBe(false);
    });

    it("rejects a missing title", () => {
        expect(
            createPageSchema.safeParse({ websiteId: "website-1", path: "", title: "" }).success
        ).toBe(false);
    });
});

function validWebsite(overrides: Partial<Record<string, unknown>>) {
    return {
        name: "Stadt Musterstadt",
        slug: "musterstadt",
        templateKey: "municipal",
        ...overrides,
    };
}
