import { instant, number } from '../models/field-schema';

import { defineContent } from './define-content';
import { sampleInstant } from './sample-instant';
import { compareText, label, recordId, title } from './shared-fields';
import { smartCityCategory } from './smart-city-fields';

const DAYS_PER_MONTH = 30;

/**
 * One point of a measurement over time. Rows that share a `series` form one
 * line, which is how time series arrive from tabular and REST sources and
 * what the field mapping can express (it cannot build a nested list).
 *
 * Newest first, so the list limit keeps the most recent observations; the
 * chart orders the chosen series chronologically.
 */
export const smartCityObservationContent = defineContent({
  shape: {
    id: recordId(),
    series: title(),
    observedAt: instant(),
    value: number(),
    unit: label(),
    category: smartCityCategory(),
  },
  rule: {
    compare: (first, second) => compareText(second.observedAt, first.observedAt),
    categoryOf: (observation) => observation.category,
  },
}).withSample((now) => {
  const point = ({ monthsAgo, value }: { readonly monthsAgo: number; readonly value: number }) => ({
    id: `sample-observation-${monthsAgo}`,
    series: 'CO₂-Emissionen',
    observedAt: sampleInstant(now, {
      days: -monthsAgo * DAYS_PER_MONTH,
      hour: 0,
    }),
    value,
    unit: 't pro Einwohner',
    category: 'sustainability' as const,
  });

  return [
    point({ monthsAgo: 0, value: 4.2 }),
    point({ monthsAgo: 1, value: 4.3 }),
    point({ monthsAgo: 2, value: 4.5 }),
    point({ monthsAgo: 3, value: 4.6 }),
    point({ monthsAgo: 4, value: 4.7 }),
    point({ monthsAgo: 5, value: 4.8 }),
  ];
});
