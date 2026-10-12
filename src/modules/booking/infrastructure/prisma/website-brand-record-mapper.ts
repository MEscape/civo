/** Field list for `.select(...)`: the only column of a theme a booking message uses. */
export const WEBSITE_BRAND_SELECT = ['primaryColor'] as const satisfies readonly ['primaryColor'];

export interface WebsiteBrandRecord {
  readonly primaryColor: string;
}

/** The primary colour of a theme record, or `null` when the website has no theme. */
export function toPrimaryColor(record: WebsiteBrandRecord | null): string | null {
  return record === null ? null : record.primaryColor;
}
