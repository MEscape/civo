import type { ValidationAppError, FieldErrorBag } from '@lib/errors';
import { fieldPath } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { literalGuard, isDefined } from '@lib/utils';

import { WEBSITE_VALIDATION_CODES, createWebsiteErrorBag } from '../errors/website-errors';

const CODES = WEBSITE_VALIDATION_CODES;

/**
 * The curated set of self-hosted fonts. Single source of truth for the
 * settings form, validation and tests. Every family listed here needs a
 * matching loaded font and a CSS stack in presentation (`theme-css.ts`,
 * which is typed `Record<ThemeFontFamily, ...>` so a gap fails to compile).
 */
export const THEME_FONT_FAMILIES = ['Source Serif 4', 'Inter', 'DM Sans', 'Geist'] as const;
export type ThemeFontFamily = (typeof THEME_FONT_FAMILIES)[number];

/** Body copy excludes the serif display face. */
export const BODY_FONT_FAMILIES = [
  'Inter',
  'DM Sans',
  'Geist',
] as const satisfies readonly ThemeFontFamily[];
export type BodyFontFamily = (typeof BODY_FONT_FAMILIES)[number];

export const THEME_RADII = ['none', 'sm', 'md', 'lg'] as const;
export type ThemeRadius = (typeof THEME_RADII)[number];

export const THEME_SPACING_SCALES = ['compact', 'comfortable', 'spacious'] as const;
export type ThemeSpacingScale = (typeof THEME_SPACING_SCALES)[number];

export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * What a municipality may customise. Deliberately a closed set of
 * validated tokens, never free-form CSS: nothing stored here can inject
 * styling beyond these fields.
 */
export interface WebsiteTheme {
  readonly colors: {
    readonly primary: string;
    readonly secondary: string;
    readonly accent: string;
  };
  readonly typography: {
    readonly headingFont: ThemeFontFamily;
    readonly bodyFont: BodyFontFamily;
  };
  readonly radius: ThemeRadius;
  readonly spacingScale: ThemeSpacingScale;
}

export const DEFAULT_WEBSITE_THEME: WebsiteTheme = {
  colors: { primary: '#1F3A34', secondary: '#7A8B85', accent: '#C9782F' },
  typography: { headingFont: 'Source Serif 4', bodyFont: 'Inter' },
  radius: 'md',
  spacingScale: 'comfortable',
};

/** Untrusted theme values, shaped like `WebsiteTheme` but not yet checked. */
export interface WebsiteThemeInput {
  readonly colors: {
    readonly primary: string;
    readonly secondary: string;
    readonly accent: string;
  };
  readonly typography: {
    readonly headingFont: string;
    readonly bodyFont: string;
  };
  readonly radius: string;
  readonly spacingScale: string;
}

/** Stored values: any field may be missing or outdated. See `restoreWebsiteTheme`. */
export interface StoredWebsiteTheme {
  readonly colors?: {
    readonly primary?: string | null;
    readonly secondary?: string | null;
    readonly accent?: string | null;
  };
  readonly typography?: {
    readonly headingFont?: string | null;
    readonly bodyFont?: string | null;
  };
  readonly radius?: string | null;
  readonly spacingScale?: string | null;
}

export const isThemeFontFamily = literalGuard(THEME_FONT_FAMILIES);
export const isBodyFontFamily = literalGuard(BODY_FONT_FAMILIES);
export const isThemeRadius = literalGuard(THEME_RADII);
export const isThemeSpacingScale = literalGuard(THEME_SPACING_SCALES);

/** Where a rejected value is reported. */
interface Rejection {
  readonly path: string;
  readonly code: string;
  readonly bag: FieldErrorBag;
}

function narrow<T extends string>(
  value: string,
  guard: (candidate: string) => candidate is T,
  { path, code, bag }: Rejection,
): T | null {
  if (guard(value)) {
    return value;
  }
  bag.add(path, code);
  return null;
}

function checkColor(value: string, path: string, bag: FieldErrorBag): string | null {
  if (HEX_COLOR_PATTERN.test(value)) {
    return value;
  }
  bag.add(path, CODES.colorInvalid);
  return null;
}

/**
 * Builds a theme from untrusted input, reporting every invalid field.
 * This is the only way new theme values enter the system.
 */
export function createWebsiteTheme(
  input: WebsiteThemeInput,
): AppResult<WebsiteTheme, ValidationAppError> {
  const bag = createWebsiteErrorBag();

  const primary = checkColor(input.colors.primary, fieldPath('colors', 'primary'), bag);
  const secondary = checkColor(input.colors.secondary, fieldPath('colors', 'secondary'), bag);
  const accent = checkColor(input.colors.accent, fieldPath('colors', 'accent'), bag);
  const headingFont = narrow(input.typography.headingFont, isThemeFontFamily, {
    path: fieldPath('typography', 'headingFont'),
    code: CODES.fontUnsupported,
    bag,
  });
  const bodyFont = narrow(input.typography.bodyFont, isBodyFontFamily, {
    path: fieldPath('typography', 'bodyFont'),
    code: CODES.fontUnsupported,
    bag,
  });
  const radius = narrow(input.radius, isThemeRadius, {
    path: 'radius',
    code: CODES.radiusUnsupported,
    bag,
  });
  const spacingScale = narrow(input.spacingScale, isThemeSpacingScale, {
    path: 'spacingScale',
    code: CODES.spacingUnsupported,
    bag,
  });

  if (
    bag.hasErrors ||
    primary === null ||
    secondary === null ||
    accent === null ||
    headingFont === null ||
    bodyFont === null ||
    radius === null ||
    spacingScale === null
  ) {
    return err(bag.toError());
  }

  return ok({
    colors: { primary, secondary, accent },
    typography: { headingFont, bodyFont },
    radius,
    spacingScale,
  });
}

function colorOr(value: string | null | undefined, fallback: string): string {
  return isDefined(value) && HEX_COLOR_PATTERN.test(value) ? value : fallback;
}

function valueOr<T extends string>(
  value: string | null | undefined,
  guard: (candidate: string) => candidate is T,
  fallback: T,
): T {
  return isDefined(value) && guard(value) ? value : fallback;
}

/**
 * Reads stored values leniently, falling back to the platform default per
 * field. Unlike `createWebsiteTheme` this never fails: a row saved before
 * a font was removed from the curated list must still render.
 */
export function restoreWebsiteTheme(stored: StoredWebsiteTheme | null | undefined): WebsiteTheme {
  const fallback = DEFAULT_WEBSITE_THEME;
  const { colors = {}, typography = {}, radius, spacingScale } = stored ?? {};
  return {
    colors: {
      primary: colorOr(colors.primary, fallback.colors.primary),
      secondary: colorOr(colors.secondary, fallback.colors.secondary),
      accent: colorOr(colors.accent, fallback.colors.accent),
    },
    typography: {
      headingFont: valueOr(
        typography.headingFont,
        isThemeFontFamily,
        fallback.typography.headingFont,
      ),
      bodyFont: valueOr(typography.bodyFont, isBodyFontFamily, fallback.typography.bodyFont),
    },
    radius: valueOr(radius, isThemeRadius, fallback.radius),
    spacingScale: valueOr(spacingScale, isThemeSpacingScale, fallback.spacingScale),
  };
}
