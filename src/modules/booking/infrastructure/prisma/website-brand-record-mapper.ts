import type { WebsiteTheme } from '../../domain/ports/website-brand.repository';

/** Field list for `.select(...)`: the columns of a theme a booking message is drawn with. */
export const WEBSITE_BRAND_SELECT = [
  'primaryColor',
  'radius',
  'headingFont',
  'bodyFont',
  'spacingScale',
] as const satisfies ReadonlyArray<keyof WebsiteTheme>;

/** The theme record as the port's value, or `null` when the website has no theme. */
export function toWebsiteTheme(record: WebsiteTheme | null): WebsiteTheme | null {
  return record === null
    ? null
    : {
        primaryColor: record.primaryColor,
        radius: record.radius,
        headingFont: record.headingFont,
        bodyFont: record.bodyFont,
        spacingScale: record.spacingScale,
      };
}
