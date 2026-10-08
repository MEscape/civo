import { number, optional, text } from '../models/field-schema';

import { CONTENT_LIMITS as LIMITS } from './content-limits';
import { defineContent } from './define-content';
import { label, recordId, title } from './shared-fields';

/**
 * One part of a whole. Rows that share a `group` form one distribution
 * (the energy mix, the modal split); rows without a group form a single one.
 * Parts are never negative: a negative share has no slice.
 */
export const smartCityBreakdownEntryContent = defineContent({
  shape: {
    id: recordId(),
    label: title(),
    value: number({ min: 0 }),
    group: optional(text({ min: 1, max: LIMITS.label })),
    unit: label(),
  },
  rule: {},
}).withSample(() => [
  {
    id: 'sample-part-1',
    label: 'Solar',
    value: 38,
    group: 'Anteil erneuerbarer Energien',
    unit: '%',
  },
  {
    id: 'sample-part-2',
    label: 'Wind',
    value: 24,
    group: 'Anteil erneuerbarer Energien',
    unit: '%',
  },
  {
    id: 'sample-part-3',
    label: 'Wasserkraft',
    value: 10,
    group: 'Anteil erneuerbarer Energien',
    unit: '%',
  },
  {
    id: 'sample-part-4',
    label: 'Sonstige',
    value: 28,
    group: 'Anteil erneuerbarer Energien',
    unit: '%',
  },
  {
    id: 'sample-part-5',
    label: 'Zu Fuß',
    value: 22,
    group: 'Verkehrsmittel',
    unit: '%',
  },
  {
    id: 'sample-part-6',
    label: 'Rad',
    value: 18,
    group: 'Verkehrsmittel',
    unit: '%',
  },
  {
    id: 'sample-part-7',
    label: 'ÖPNV',
    value: 20,
    group: 'Verkehrsmittel',
    unit: '%',
  },
  {
    id: 'sample-part-8',
    label: 'Auto',
    value: 40,
    group: 'Verkehrsmittel',
    unit: '%',
  },
]);
