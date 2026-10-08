import { number, oneOf, optional } from '../models/field-schema';

import { defineContent } from './define-content';
import { label, recordId, title } from './shared-fields';
import { smartCityCategory } from './smart-city-fields';

export const METRIC_TRENDS = ['up', 'down', 'flat'] as const;

/**
 * A current reading shown as a figure: a KPI card, a bar, a table row.
 *
 * Only what a figure needs. A target, a series over time or a distribution
 * are other shapes (a goal, an observation, a breakdown entry) with kinds
 * of their own.
 */
export const smartCityMetricContent = defineContent({
  shape: {
    id: recordId(),
    label: title(),
    value: number(),
    unit: label(),
    category: smartCityCategory(),
    trend: optional(oneOf(METRIC_TRENDS)),
    changePercent: optional(number()),
  },
  rule: {
    categoryOf: (metric) => metric.category,
  },
}).withSample(() => [
  {
    id: 'sample-metric-1',
    label: 'CO₂-Emissionen',
    value: 4.2,
    unit: 't pro Einwohner',
    category: 'sustainability',
    trend: 'down',
    changePercent: 3.1,
  },
  {
    id: 'sample-metric-2',
    label: 'Ladepunkte für E-Fahrzeuge',
    value: 48,
    unit: 'Stück',
    category: 'mobility',
    trend: 'up',
    changePercent: 12,
  },
  {
    id: 'sample-metric-3',
    label: 'Anteil erneuerbarer Energien',
    value: 62,
    unit: '%',
    category: 'energy',
    trend: 'flat',
    changePercent: 0,
  },
  {
    id: 'sample-metric-4',
    label: 'Radwege',
    value: 124,
    unit: 'km',
    category: 'mobility',
  },
]);
