import { describe, it, expect } from "vitest";
import {
    defaultTheme,
    toDomainTheme,
    themeToCssVariables,
    AVAILABLE_HEADING_FONTS,
    AVAILABLE_BODY_FONTS,
} from "@/modules/website/domain/theme";
import { contrastRatio, PAGE_BACKGROUND } from "@/modules/website/domain/contrast";

/**
 * Added per architecture review §P: theme.ts had no dedicated test file
 * despite being a pure function with a clear fallback-default contract —
 * exactly the kind of logic worth pinning down before it's touched again.
 */

describe("toDomainTheme", () => {
    it("returns the platform default theme when given null", () => {
        expect(toDomainTheme(null)).toEqual(defaultTheme);
    });

    it("returns the platform default theme when given undefined", () => {
        expect(toDomainTheme(undefined)).toEqual(defaultTheme);
    });

    it("maps a fully-populated raw row without falling back to defaults", () => {
        const raw = {
            primaryColor: "#111111",
            secondaryColor: "#222222",
            accentColor: "#333333",
            headingFont: "DM Sans",
            bodyFont: "DM Sans",
            radius: "lg",
            spacingScale: "spacious",
        };
        expect(toDomainTheme(raw)).toEqual({
            colors: { primary: "#111111", secondary: "#222222", accent: "#333333" },
            typography: { headingFont: "DM Sans", bodyFont: "DM Sans" },
            radius: "lg",
            spacingScale: "spacious",
        });
    });

    it("falls back to platform defaults field-by-field for null values", () => {
        const raw = {
            primaryColor: null,
            secondaryColor: "#222222",
            accentColor: null,
            headingFont: null,
            bodyFont: "DM Sans",
            radius: null,
            spacingScale: null,
        };
        const result = toDomainTheme(raw);
        expect(result.colors.primary).toBe(defaultTheme.colors.primary);
        expect(result.colors.secondary).toBe("#222222");
        expect(result.colors.accent).toBe(defaultTheme.colors.accent);
        expect(result.typography.headingFont).toBe(defaultTheme.typography.headingFont);
        expect(result.typography.bodyFont).toBe("DM Sans");
        expect(result.radius).toBe(defaultTheme.radius);
        expect(result.spacingScale).toBe(defaultTheme.spacingScale);
    });

    it("falls back to platform defaults field-by-field for missing (undefined) fields", () => {
        const result = toDomainTheme({ primaryColor: "#abcabc" });
        expect(result.colors.primary).toBe("#abcabc");
        expect(result.colors.secondary).toBe(defaultTheme.colors.secondary);
        expect(result.colors.accent).toBe(defaultTheme.colors.accent);
        expect(result.typography).toEqual(defaultTheme.typography);
        expect(result.radius).toBe(defaultTheme.radius);
        expect(result.spacingScale).toBe(defaultTheme.spacingScale);
    });

    it("treats an empty string as falsy and falls back to the default", () => {
        // `||` (not `??`) is used deliberately in toDomainTheme, so an empty
        // string (e.g. a legacy row with a blank column) falls back too.
        const result = toDomainTheme({ primaryColor: "" });
        expect(result.colors.primary).toBe(defaultTheme.colors.primary);
    });
});

describe("themeToCssVariables", () => {
    it("produces exactly the documented set of CSS custom properties", () => {
        const vars = themeToCssVariables(defaultTheme);
        expect(Object.keys(vars).sort()).toEqual(
            [
                "--civo-color-primary",
                "--civo-color-secondary",
                "--civo-color-accent",
                "--civo-color-primary-foreground",
                "--civo-color-secondary-foreground",
                "--civo-color-accent-foreground",
                "--civo-color-primary-copy",
                "--civo-color-secondary-copy",
                "--civo-color-accent-copy",
                "--civo-font-heading",
                "--civo-font-body",
                "--civo-radius",
                "--civo-section-spacing",
            ].sort()
        );
    });

    it("maps colors through verbatim", () => {
        const vars = themeToCssVariables(defaultTheme);
        expect(vars["--civo-color-primary"]).toBe(defaultTheme.colors.primary);
        expect(vars["--civo-color-secondary"]).toBe(defaultTheme.colors.secondary);
        expect(vars["--civo-color-accent"]).toBe(defaultTheme.colors.accent);
    });

    describe("brand color accessibility", () => {
        const withColors = (primary: string, secondary: string, accent: string) => ({
            ...defaultTheme,
            colors: { primary, secondary, accent },
        });

        it("picks a readable text color to put ON each brand color", () => {
            // Smart City sample: near-black primary, cyan accent (white on cyan is 1.5:1).
            const vars = themeToCssVariables(withColors("#1a1a1a", "#333333", "#00e5ff"));
            expect(vars["--civo-color-primary-foreground"]).toBe("#ffffff");
            expect(vars["--civo-color-secondary-foreground"]).toBe("#ffffff");
            expect(vars["--civo-color-accent-foreground"]).toBe("#000000");
        });

        it("provides a variant of each brand color that is readable AS text on the page", () => {
            const vars = themeToCssVariables(withColors("#f2a900", "#7a8b85", "#00e5ff"));
            for (const key of ["primary", "secondary", "accent"] as const) {
                const copy = vars[`--civo-color-${key}-copy`];
                expect(contrastRatio(copy, PAGE_BACKGROUND), key).toBeGreaterThanOrEqual(4.5);
            }
        });

        it("leaves an already-readable brand color exactly as chosen", () => {
            const vars = themeToCssVariables(withColors("#1a1a1a", "#333333", "#024b6d"));
            expect(vars["--civo-color-primary-copy"]).toBe("#1a1a1a");
            expect(vars["--civo-color-secondary-copy"]).toBe("#333333");
            expect(vars["--civo-color-accent-copy"]).toBe("#024b6d");
        });

        it("still emits the raw brand color for fills, borders and backgrounds", () => {
            const vars = themeToCssVariables(withColors("#111111", "#222222", "#00e5ff"));
            expect(vars["--civo-color-accent"]).toBe("#00e5ff");
        });

        it("does not throw on a half-typed color (the settings preview passes these through)", () => {
            expect(() => themeToCssVariables(withColors("#1A1", "", "not-a-color"))).not.toThrow();
        });
    });

    it("resolves font names to their loaded CSS variable with a sane fallback stack", () => {
        const vars = themeToCssVariables(defaultTheme);
        expect(vars["--civo-font-heading"]).toBe("var(--font-source-serif), ui-serif, Georgia, serif");
        expect(vars["--civo-font-body"]).toBe("var(--font-inter), ui-sans-serif, system-ui, sans-serif");
    });

    it("falls back to the default font variable for an unrecognized/legacy font name", () => {
        // e.g. a theme row saved before a font was removed from
        // AVAILABLE_HEADING_FONTS/AVAILABLE_BODY_FONTS.
        const vars = themeToCssVariables({
            ...defaultTheme,
            typography: { headingFont: "Playfair Display", bodyFont: "Roboto" },
        });
        expect(vars["--civo-font-heading"]).toBe("var(--font-source-serif), ui-serif, Georgia, serif");
        expect(vars["--civo-font-body"]).toBe("var(--font-inter), ui-sans-serif, system-ui, sans-serif");
    });

    it("maps every radius enum value to a concrete pixel value", () => {
        const radii: Array<[typeof defaultTheme.radius, string]> = [
            ["none", "0px"],
            ["sm", "2px"],
            ["md", "6px"],
            ["lg", "12px"],
        ];
        for (const [radius, expected] of radii) {
            const vars = themeToCssVariables({ ...defaultTheme, radius });
            expect(vars["--civo-radius"]).toBe(expected);
        }
    });

    it("maps every spacing scale enum value to a concrete rem value", () => {
        const scales: Array<[typeof defaultTheme.spacingScale, string]> = [
            ["compact", "2.5rem"],
            ["comfortable", "4rem"],
            ["spacious", "6rem"],
        ];
        for (const [spacingScale, expected] of scales) {
            const vars = themeToCssVariables({ ...defaultTheme, spacingScale });
            expect(vars["--civo-section-spacing"]).toBe(expected);
        }
    });

    it("never emits a value containing an HTML/script-breaking sequence for the curated font lists", () => {
        // Defensive regression check: since font names flow straight into a
        // CSS custom property (and this is the ONLY path stored theme data
        // becomes CSS — see theme.ts's own comment), every font in the
        // curated allowlists must be a plain, safe identifier.
        for (const font of [...AVAILABLE_HEADING_FONTS, ...AVAILABLE_BODY_FONTS]) {
            expect(font).not.toMatch(/[<>"';{}]/);
        }
    });
});
