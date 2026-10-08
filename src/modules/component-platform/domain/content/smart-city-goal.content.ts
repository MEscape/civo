import { number } from '../models/field-schema';

import { defineContent } from './define-content';
import { label, recordId, title } from './shared-fields';
import { smartCityCategory } from './smart-city-fields';

/**
 * A reading together with the value it should reach: what a gauge or a
 * current-versus-target chart shows. The target is required, so a dataset
 * that cannot provide one is not offered for these components at all.
 */
export const smartCityGoalContent = defineContent({
  shape: {
    id: recordId(),
    label: title(),
    value: number(),
    target: number(),
    unit: label(),
    category: smartCityCategory(),
  },
  rule: {
    categoryOf: (goal) => goal.category,
  },
}).withSample(() => [
  {
    id: 'sample-goal-1',
    label: 'CO₂-Emissionen',
    value: 4.2,
    target: 3,
    unit: 't pro Einwohner',
    category: 'sustainability',
  },
  {
    id: 'sample-goal-2',
    label: 'Anteil erneuerbarer Energien',
    value: 62,
    target: 100,
    unit: '%',
    category: 'energy',
  },
  {
    id: 'sample-goal-3',
    label: 'Ladepunkte für E-Fahrzeuge',
    value: 48,
    target: 80,
    unit: 'Stück',
    category: 'mobility',
  },
]);
