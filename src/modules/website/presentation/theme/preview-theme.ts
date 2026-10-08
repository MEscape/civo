import { isDefined } from '@lib/utils';

import { HEX_COLOR_PATTERN } from '../../application/contracts/website-constraints';

import type { WebsiteThemeView } from '../../application/contracts/website-views';

/** What the form watcher yields mid-edit: every field may be missing or half-typed. */
export interface PartialThemeSettings {
  readonly colors?: {
    readonly primary?: string;
    readonly secondary?: string;
    readonly accent?: string;
  };
  readonly typography?: {
    readonly headingFont?: WebsiteThemeView['typography']['headingFont'];
    readonly bodyFont?: WebsiteThemeView['typography']['bodyFont'];
  };
  readonly radius?: WebsiteThemeView['radius'];
  readonly spacingScale?: WebsiteThemeView['spacingScale'];
}

function validColor(value: string | undefined, fallback: string): string {
  return isDefined(value) && HEX_COLOR_PATTERN.test(value) ? value : fallback;
}

/**
 * A live preview must never render half-typed input ("#12"), which CSS
 * would drop, so each colour keeps its last saved value until it is valid.
 */
export function toPreviewTheme(
  values: PartialThemeSettings,
  saved: WebsiteThemeView,
): WebsiteThemeView {
  return {
    colors: {
      primary: validColor(values.colors?.primary, saved.colors.primary),
      secondary: validColor(values.colors?.secondary, saved.colors.secondary),
      accent: validColor(values.colors?.accent, saved.colors.accent),
    },
    typography: {
      headingFont: values.typography?.headingFont ?? saved.typography.headingFont,
      bodyFont: values.typography?.bodyFont ?? saved.typography.bodyFont,
    },
    radius: values.radius ?? saved.radius,
    spacingScale: values.spacingScale ?? saved.spacingScale,
  };
}
