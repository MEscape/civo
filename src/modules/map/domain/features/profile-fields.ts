import type { FieldProfile, MapFeature } from './map-features';

export const PROFILE_LIMITS = {
  /** More distinct values than this are not enumerated: such a field has no categories or filter options. */
  maxDistinct: 50,
} as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T|$)/;

/** ISO date or date-time, the only text the map treats as a point in time. */
export function isDateValue(value: string): boolean {
  return DATE_PATTERN.test(value);
}

type ValueKind = 'string' | 'number' | 'boolean';

/** Everything learned about one attribute while walking the features once. */
class FieldObservations {
  private readonly kinds = new Set<ValueKind>();
  private readonly counts = new Map<string, number>();
  private hasOverflowed = false;
  private min = Number.POSITIVE_INFINITY;
  private max = Number.NEGATIVE_INFINITY;
  private areAllDates = true;
  private minText: string | null = null;
  private maxText: string | null = null;

  observe(value: string | number | boolean): void {
    if (typeof value === 'number') {
      this.kinds.add('number');
      this.min = Math.min(this.min, value);
      this.max = Math.max(this.max, value);
      return;
    }
    this.kinds.add(typeof value === 'boolean' ? 'boolean' : 'string');
    if (typeof value === 'string') {
      this.areAllDates &&= isDateValue(value);
      this.minText = this.minText === null || value < this.minText ? value : this.minText;
      this.maxText = this.maxText === null || value > this.maxText ? value : this.maxText;
    }
    this.count(String(value));
  }

  /** `null` when the values mix types: such a field cannot be coloured, sized or filtered meaningfully. */
  toProfile(key: string): FieldProfile | null {
    const [only, ...others] = this.kinds;
    if (only === undefined || others.length > 0) {
      return null;
    }
    if (only === 'number') {
      return { key, type: 'number', distinct: null, min: this.min, max: this.max };
    }
    if (only === 'boolean') {
      return { key, type: 'boolean', distinct: this.distinct() };
    }
    if (this.areAllDates && this.minText !== null && this.maxText !== null) {
      return { key, type: 'date', distinct: null, min: this.minText, max: this.maxText };
    }
    return { key, type: 'text', distinct: this.distinct() };
  }

  private count(text: string): void {
    const known = this.counts.get(text);
    if (known !== undefined) {
      this.counts.set(text, known + 1);
    } else if (this.counts.size < PROFILE_LIMITS.maxDistinct) {
      this.counts.set(text, 1);
    } else {
      this.hasOverflowed = true;
    }
  }

  private distinct(): FieldProfile['distinct'] {
    if (this.hasOverflowed) {
      return null;
    }
    return [...this.counts]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'en'));
  }
}

/** One pass over a layer's features: what attributes exist, of which type, with which values. */
export function profileFields(features: readonly MapFeature[]): readonly FieldProfile[] {
  const observations = new Map<string, FieldObservations>();
  for (const feature of features) {
    for (const [key, value] of Object.entries(feature.attributes)) {
      const field = observations.get(key) ?? new FieldObservations();
      field.observe(value);
      observations.set(key, field);
    }
  }

  return [...observations].flatMap(([key, field]) => {
    const profile = field.toProfile(key);
    return profile === null ? [] : [profile];
  });
}
