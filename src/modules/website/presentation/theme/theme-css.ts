import { readableForeground } from './readable-foreground';

import type {
  ThemeFontFamily,
  ThemeRadius,
  ThemeSpacingScale,
} from '../../application/contracts/website-constraints';
import type { WebsiteThemeView } from '../../application/contracts/website-views';

/**
 * Each curated family maps to the CSS variable its font loader exposes,
 * plus a fallback stack of the matching kind. Typed over the whole family
 * list: a family added to the domain without a stack here does not compile.
 * Loaders live in `@lib/fonts`.
 */
const FONT_STACK = {
  'Source Serif 4': 'var(--font-serif), ui-serif, Georgia, serif',
  Inter: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
  'DM Sans': 'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
  Geist: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
} as const satisfies Record<ThemeFontFamily, string>;

const RADIUS_VALUE = {
  none: '0px',
  sm: '2px',
  md: '6px',
  lg: '12px',
} as const satisfies Record<ThemeRadius, string>;

const SECTION_SPACING_VALUE = {
  compact: '2.5rem',
  comfortable: '4rem',
  spacious: '6rem',
} as const satisfies Record<ThemeSpacingScale, string>;

/**
 * The ONLY bridge from stored theme data to styling. Every value is drawn
 * from a validated token or a fixed lookup table; no stored string is ever
 * emitted as raw CSS. Foreground colours are derived so text stays legible
 * whichever brand colours a municipality picks.
 */
export function themeToCssVariables(theme: WebsiteThemeView): Record<string, string> {
  const { primary, secondary, accent } = theme.colors;
  return {
    '--civo-color-primary': primary,
    '--civo-color-secondary': secondary,
    '--civo-color-accent': accent,
    '--civo-color-primary-foreground': readableForeground(primary),
    '--civo-color-secondary-foreground': readableForeground(secondary),
    '--civo-color-accent-foreground': readableForeground(accent),
    '--civo-font-heading': FONT_STACK[theme.typography.headingFont],
    '--civo-font-body': FONT_STACK[theme.typography.bodyFont],
    '--civo-radius': RADIUS_VALUE[theme.radius],
    '--civo-section-spacing': SECTION_SPACING_VALUE[theme.spacingScale],
  };
}
