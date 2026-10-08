import { optional, text, url } from '../models/field-schema';

import { CONTENT_LIMITS as LIMITS } from './content-limits';

/** The fields almost every record shares, so a limit is chosen once. */
export const recordId = () => text({ min: 1, max: LIMITS.id });
export const title = () => text({ min: 1, max: LIMITS.title });
export const label = () => optional(text({ max: LIMITS.label }));
export const shortText = () => optional(text({ max: LIMITS.shortText }));
export const longText = () => optional(text({ max: LIMITS.longText }));
export const imageUrl = () => optional(url({ max: LIMITS.url, allowRelative: false }));
export const linkTarget = () => url({ max: LIMITS.url, allowRelative: true });
export const optionalLinkTarget = () => optional(linkTarget());

/** Canonical instants share one string form, so text order is time order. Locale-independent. */
export function compareText(first: string, second: string): number {
  if (first === second) {
    return 0;
  }
  return first < second ? -1 : 1;
}
