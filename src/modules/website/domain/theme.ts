/**
 * Website theme domain model.
 *
 * A municipality can eventually customize these fields (via the future
 * admin editor) without ever touching a React component or writing raw
 * CSS — see spec §9. `radius` and `spacingScale` are controlled enums,
 * not free-form values, which keeps the visual system coherent across
 * every website built on the platform.
 */
import { ensureContrast, readableForeground, PAGE_BACKGROUND } from "./contrast";

export type ThemeRadius = "none" | "sm" | "md" | "lg";
export type ThemeSpacingScale = "compact" | "comfortable" | "spacious";

export type WebsiteTheme = {
    colors: {
        primary: string;
        secondary: string;
        accent: string;
    };
    typography: {
        headingFont: string;
        bodyFont: string;
    };
    radius: ThemeRadius;
    spacingScale: ThemeSpacingScale;
};

export const defaultTheme: WebsiteTheme = {
    colors: {
        primary: "#1F3A34",
        secondary: "#7A8B85",
        accent: "#C9782F",
    },
    typography: {
        headingFont: "Source Serif 4",
        bodyFont: "Inter",
    },
    radius: "md",
    spacingScale: "comfortable",
};

/**
 * The curated set of self-hosted fonts available for selection in the
 * theme editor. Keeping this list in the domain layer makes it the
 * single source of truth — the settings form, any future API, and tests
 * all import from here rather than duplicating string literals.
 *
 * Every name listed here MUST have a matching entry in
 * `FONT_VARIABLE_BY_FAMILY` below, which is what actually connects a
 * selected family to a loaded `next/font/local` CSS variable — see
 * `src/lib/fonts/local-fonts.ts`.
 */
export const AVAILABLE_HEADING_FONTS = [
    "Source Serif 4",
    "Inter",
    "DM Sans",
    "Geist",
] as const;

export const AVAILABLE_BODY_FONTS = [
    "Inter",
    "DM Sans",
    "Geist",
] as const;

export type AvailableHeadingFont = (typeof AVAILABLE_HEADING_FONTS)[number];
export type AvailableBodyFont = (typeof AVAILABLE_BODY_FONTS)[number];

/**
 * Maps a selectable font family name to the CSS custom property that
 * `next/font/local` generated for it (see `src/lib/fonts/local-fonts.ts`).
 * This is the ONLY place that translates a stored/user-facing font name
 * into an actual loaded typeface — `themeToCssVariables` never embeds a
 * bare font-family string, which is what guarantees a selected font is
 * always backed by a font file this deployment actually serves.
 */
export const FONT_VARIABLE_BY_FAMILY: Record<AvailableHeadingFont | AvailableBodyFont, string> = {
    "Source Serif 4": "var(--font-source-serif)",
    "Inter": "var(--font-inter)",
    "DM Sans": "var(--font-dm-sans)",
    "Geist": "var(--font-geist-sans)",
};

const radiusValues: Record<ThemeRadius, string> = {
    none: "0px",
    sm: "2px",
    md: "6px",
    lg: "12px",
};

const spacingSectionValues: Record<ThemeSpacingScale, string> = {
    compact: "2.5rem",
    comfortable: "4rem",
    spacious: "6rem",
};

/**
 * The minimal structural shape of a raw database Theme row that
 * `toDomainTheme` can accept. This matches the Prisma `Theme` model's
 * nullable fields without importing `@prisma/client` into the domain
 * layer (which must remain framework-free).
 */
type RawThemeRow = {
    primaryColor?: string | null;
    secondaryColor?: string | null;
    accentColor?: string | null;
    headingFont?: string | null;
    bodyFont?: string | null;
    radius?: string | null;
    spacingScale?: string | null;
};

/**
 * Maps a partial/raw database theme object to a guaranteed-valid
 * WebsiteTheme domain object, falling back to platform defaults for any
 * missing or null field.
 *
 * This is the ONLY place that crosses the Prisma → domain boundary for
 * theme data. The `any` type is deliberately avoided: the structural
 * `RawThemeRow` type enforces that callers pass something plausible while
 * keeping the domain layer free of `@prisma/client` imports.
 */
export function toDomainTheme(rawTheme: RawThemeRow | null | undefined): WebsiteTheme {
    if (!rawTheme) return defaultTheme;
    return {
        colors: {
            primary: rawTheme.primaryColor || defaultTheme.colors.primary,
            secondary: rawTheme.secondaryColor || defaultTheme.colors.secondary,
            accent: rawTheme.accentColor || defaultTheme.colors.accent,
        },
        typography: {
            headingFont: rawTheme.headingFont || defaultTheme.typography.headingFont,
            bodyFont: rawTheme.bodyFont || defaultTheme.typography.bodyFont,
        },
        radius: (rawTheme.radius && rawTheme.radius in radiusValues)
            ? (rawTheme.radius as ThemeRadius)
            : defaultTheme.radius,
        spacingScale: (rawTheme.spacingScale && rawTheme.spacingScale in spacingSectionValues)
            ? (rawTheme.spacingScale as ThemeSpacingScale)
            : defaultTheme.spacingScale,
    };
}

/**
 * Resolves a stored font family name to its loaded CSS variable,
 * falling back to the body-font stack if the name isn't (or is no
 * longer) one of the self-hosted families — e.g. legacy theme rows
 * saved before a font was removed from `AVAILABLE_*_FONTS`.
 */
function resolveFontVariable(familyName: string, fallback: keyof typeof FONT_VARIABLE_BY_FAMILY): string {
    return FONT_VARIABLE_BY_FAMILY[familyName as AvailableHeadingFont | AvailableBodyFont] ?? FONT_VARIABLE_BY_FAMILY[fallback];
}

/**
 * Converts a WebsiteTheme into CSS custom properties. This is the ONLY
 * bridge between stored theme data and rendered styling — there is no
 * path anywhere in the application that injects raw/arbitrary CSS from
 * stored data (spec §9, §34).
 *
 * Fonts resolve to `var(--font-*)` references produced by the
 * self-hosted `next/font/local` loaders (see
 * `src/lib/fonts/local-fonts.ts`) rather than bare family-name strings,
 * so a selected theme font is always backed by a font file this
 * deployment actually serves — never a request to an external font CDN.
 *
 * Each brand color yields three variables, because a municipality's color
 * cannot be assumed readable in every role:
 *  - `--civo-color-X`             the color itself (fills, borders, backgrounds)
 *  - `--civo-color-X-foreground`  white or black text to put ON that color
 *  - `--civo-color-X-copy`        the color as text/icon ON the page, darkened
 *                                 just enough to meet WCAG AA (4.5:1) and
 *                                 unchanged when it already does
 * Components pick the variable for the role; none of them assume the raw
 * brand color is legible.
 */
export function themeToCssVariables(theme: WebsiteTheme): Record<string, string> {
    return {
        "--civo-color-primary": theme.colors.primary,
        "--civo-color-secondary": theme.colors.secondary,
        "--civo-color-accent": theme.colors.accent,
        "--civo-color-primary-foreground": readableForeground(theme.colors.primary),
        "--civo-color-secondary-foreground": readableForeground(theme.colors.secondary),
        "--civo-color-accent-foreground": readableForeground(theme.colors.accent),
        "--civo-color-primary-copy": ensureContrast(theme.colors.primary, PAGE_BACKGROUND),
        "--civo-color-secondary-copy": ensureContrast(theme.colors.secondary, PAGE_BACKGROUND),
        "--civo-color-accent-copy": ensureContrast(theme.colors.accent, PAGE_BACKGROUND),
        "--civo-font-heading": `${resolveFontVariable(theme.typography.headingFont, "Source Serif 4")}, ui-serif, Georgia, serif`,
        "--civo-font-body": `${resolveFontVariable(theme.typography.bodyFont, "Inter")}, ui-sans-serif, system-ui, sans-serif`,
        "--civo-radius": radiusValues[theme.radius],
        "--civo-section-spacing": spacingSectionValues[theme.spacingScale],
    };
}
