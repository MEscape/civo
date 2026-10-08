import type { FieldProfile, MapFeature, MapLayer } from '../features/map-features';

export const FILTER_LIMITS = {
  maxFilters: 4,
  maxOptions: 12,
} as const;

/** Preferred order: the attributes civic data most often means to be filtered by. */
const FILTER_PRIORITY = ['status', 'category', 'observedAt', 'value'] as const;
const DATE_LENGTH = 10;

export interface SelectFilter {
  readonly kind: 'select';
  readonly field: string;
  readonly options: ReadonlyArray<{ readonly value: string; readonly count: number }>;
}

export interface RangeFilter {
  readonly kind: 'range';
  readonly field: string;
  readonly min: number;
  readonly max: number;
}

/** Dates compare as `YYYY-MM-DD` (UTC), the precision a person picks. */
export interface DateRangeFilter {
  readonly kind: 'dateRange';
  readonly field: string;
  readonly min: string;
  readonly max: string;
}

export type FilterDefinition = SelectFilter | RangeFilter | DateRangeFilter;

export type FilterValue =
  | { readonly kind: 'select'; readonly selected: readonly string[] }
  | { readonly kind: 'range'; readonly min: number | null; readonly max: number | null }
  | { readonly kind: 'dateRange'; readonly from: string | null; readonly to: string | null };

/** Active filters by field name. A field absent here is not filtered. */
export type FilterState = Readonly<Record<string, FilterValue>>;

function definitionOf(profile: FieldProfile): FilterDefinition | null {
  if (
    profile.type === 'number' &&
    typeof profile.min === 'number' &&
    typeof profile.max === 'number'
  ) {
    return profile.min < profile.max
      ? { kind: 'range', field: profile.key, min: profile.min, max: profile.max }
      : null;
  }
  if (
    profile.type === 'date' &&
    typeof profile.min === 'string' &&
    typeof profile.max === 'string'
  ) {
    const min = profile.min.slice(0, DATE_LENGTH);
    const max = profile.max.slice(0, DATE_LENGTH);
    return min < max ? { kind: 'dateRange', field: profile.key, min, max } : null;
  }
  const distinct = profile.distinct;
  if (distinct !== null && distinct.length >= 2 && distinct.length <= FILTER_LIMITS.maxOptions) {
    return { kind: 'select', field: profile.key, options: distinct };
  }
  return null;
}

/** Two layers' value counts for one field, summed; too many distinct values is no longer a select. */
function mergeSelects(first: SelectFilter, second: SelectFilter): SelectFilter | null {
  const counts = new Map(first.options.map((option) => [option.value, option.count]));
  for (const option of second.options) {
    counts.set(option.value, (counts.get(option.value) ?? 0) + option.count);
  }
  const options = [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'en'));
  return options.length <= FILTER_LIMITS.maxOptions ? { ...first, options } : null;
}

/** The same field in two layers: one filter covering both, or `null` when they disagree on its kind. */
function mergeDefinitions(
  first: FilterDefinition,
  second: FilterDefinition,
): FilterDefinition | null {
  if (first.kind === 'range' && second.kind === 'range') {
    return { ...first, min: Math.min(first.min, second.min), max: Math.max(first.max, second.max) };
  }
  if (first.kind === 'dateRange' && second.kind === 'dateRange') {
    return {
      ...first,
      min: first.min < second.min ? first.min : second.min,
      max: first.max > second.max ? first.max : second.max,
    };
  }
  if (first.kind === 'select' && second.kind === 'select') {
    return mergeSelects(first, second);
  }
  return null;
}

function priorityOf(field: string): number {
  const index = (FILTER_PRIORITY as readonly string[]).indexOf(field);
  return index === -1 ? FILTER_PRIORITY.length : index;
}

/**
 * Filters a map can offer, read from what its layers actually contain.
 * Nothing is configured: a field earns a filter when its values vary and are
 * few enough (or ordered enough) to filter by. A field two layers disagree
 * about (text in one, number in the other) is skipped rather than guessed.
 */
export function deriveFilters(layers: readonly MapLayer[]): readonly FilterDefinition[] {
  const merged = new Map<string, FilterDefinition | null>();
  for (const layer of layers) {
    for (const profile of layer.fields) {
      const definition = definitionOf(profile);
      if (definition === null) {
        continue;
      }
      const known = merged.get(profile.key);
      merged.set(
        profile.key,
        known === undefined ? definition : known && mergeDefinitions(known, definition),
      );
    }
  }
  return [...merged.values()]
    .filter((definition): definition is FilterDefinition => definition !== null)
    .sort((a, b) => priorityOf(a.field) - priorityOf(b.field))
    .slice(0, FILTER_LIMITS.maxFilters);
}

export function isFilterActive(value: FilterValue | undefined): boolean {
  switch (value?.kind) {
    case 'select':
      return value.selected.length > 0;
    case 'range':
      return value.min !== null || value.max !== null;
    case 'dateRange':
      return value.from !== null || value.to !== null;
    case undefined:
      return false;
  }
}

export function countActiveFilters(state: FilterState): number {
  return Object.values(state).filter(isFilterActive).length;
}

/** Inclusive bounds where `null` means unbounded; works for numbers and ISO dates alike. */
function isWithin<T extends number | string>(
  candidate: T,
  lower: T | null,
  upper: T | null,
): boolean {
  return (lower === null || candidate >= lower) && (upper === null || candidate <= upper);
}

function matches(feature: MapFeature, field: string, value: FilterValue): boolean {
  if (!Object.hasOwn(feature.attributes, field)) {
    return false;
  }
  const raw = feature.attributes[field];
  switch (value.kind) {
    case 'select':
      return value.selected.includes(String(raw));
    case 'range':
      return typeof raw === 'number' && isWithin(raw, value.min, value.max);
    case 'dateRange':
      return typeof raw === 'string' && isWithin(raw.slice(0, DATE_LENGTH), value.from, value.to);
  }
}

/**
 * Features of one layer that pass every active filter. A filter only
 * constrains layers that have its field: filtering parking by `status` must
 * not make an unrelated districts layer disappear.
 */
export function filterFeatures(layer: MapLayer, state: FilterState): readonly MapFeature[] {
  const applicable = Object.entries(state).filter(
    ([field, value]) =>
      isFilterActive(value) && layer.fields.some((profile) => profile.key === field),
  );
  if (applicable.length === 0) {
    return layer.features;
  }
  return layer.features.filter((feature) =>
    applicable.every(([field, value]) => matches(feature, field, value)),
  );
}
