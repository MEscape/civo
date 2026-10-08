import { oneOf, withFallback } from '../models/field-schema';

/**
 * Fields the smart-city kinds have in common. Only what is genuinely the
 * same thing in every kind lives here; a field one kind needs and another
 * does not (a target, a series, a group) belongs to that kind alone.
 */
export const SMART_CITY_CATEGORIES = ['sustainability', 'mobility', 'energy', 'other'] as const;

/** An unknown category spelling degrades to `other` instead of costing the municipality the record. */
export const smartCityCategory = () => withFallback(oneOf(SMART_CITY_CATEGORIES), 'other');
