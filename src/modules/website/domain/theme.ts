/**
 * Website theme domain model.
 *
 * A municipality can eventually customize these fields (via the future
 * admin editor) without ever touching a React component or writing raw
 * CSS — see spec §9. `radius` and `spacingScale` are controlled enums,
 * not free-form values, which keeps the visual system coherent across
 * every website built on the platform.
 */
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
 * The curated set of Google Fonts available for selection in the theme
 * editor. Keeping this list in the domain layer makes it the single
 * source of truth — the settings form, any future API, and tests all
 * import from here rather than duplicating string literals.
 */
export const AVAILABLE_HEADING_FONTS = [
    "Source Serif 4",
    "Playfair Display",
    "Inter",
    "Roboto",
] as const;

export const AVAILABLE_BODY_FONTS = [
    "Inter",
    "Roboto",
    "Open Sans",
] as const;

export type AvailableHeadingFont = (typeof AVAILABLE_HEADING_FONTS)[number];
export type AvailableBodyFont = (typeof AVAILABLE_BODY_FONTS)[number];

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
        radius: (rawTheme.radius as ThemeRadius) || defaultTheme.radius,
        spacingScale: (rawTheme.spacingScale as ThemeSpacingScale) || defaultTheme.spacingScale,
    };
}

/**
 * Converts a WebsiteTheme into CSS custom properties. This is the ONLY
 * bridge between stored theme data and rendered styling — there is no
 * path anywhere in the application that injects raw/arbitrary CSS from
 * stored data (spec §9, §34).
 */
export function themeToCssVariables(theme: WebsiteTheme): Record<string, string> {
    return {
        "--civo-color-primary": theme.colors.primary,
        "--civo-color-secondary": theme.colors.secondary,
        "--civo-color-accent": theme.colors.accent,
        "--civo-font-heading": `"${theme.typography.headingFont}", ui-serif, Georgia, serif`,
        "--civo-font-body": `"${theme.typography.bodyFont}", ui-sans-serif, system-ui, sans-serif`,
        "--civo-radius": radiusValues[theme.radius],
        "--civo-section-spacing": spacingSectionValues[theme.spacingScale],
    };
}
