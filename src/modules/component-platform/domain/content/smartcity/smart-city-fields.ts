import { text, withFallback } from '../../models/field-schema';
import { CONTENT_LIMITS } from '../content-limits';

/**
 * Fields the smart-city kinds have in common. Only what is genuinely the
 * same thing in every kind lives here; a field one kind needs and another
 * does not (a target, a series, a group) belongs to that kind alone.
 */
/** Source/config taxonomy is opaque text; missing grouping stays ungrouped. Legacy values remain valid. */
export const smartCityCategory = () =>
  withFallback(text({ max: CONTENT_LIMITS.label, trim: true }), '');
