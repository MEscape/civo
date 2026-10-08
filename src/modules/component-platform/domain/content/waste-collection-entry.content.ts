import { instant, oneOf } from '../models/field-schema';

import { defineContent } from './define-content';
import { sampleInstant } from './sample-instant';
import { compareText, label, recordId } from './shared-fields';

export const WASTE_TYPES = ['restmuell', 'biomuell', 'papier', 'gelberSack', 'sperrmuell'] as const;

const DATE_LENGTH = 10;

/**
 * One collection date. A date is relevant from the start of its day, so
 * today's collection still shows. The waste type is deliberately strict: a
 * mislabelled bin is worse than a record the mapping has to fix. The
 * `district` is the category, so a component can filter on it.
 */
export const wasteCollectionEntryContent = defineContent({
  shape: {
    id: recordId(),
    date: instant(),
    wasteType: oneOf(WASTE_TYPES),
    district: label(),
  },
  rule: {
    isRelevant: (entry, now) => entry.date.slice(0, DATE_LENGTH) >= now.slice(0, DATE_LENGTH),
    compare: (first, second) => compareText(first.date, second.date),
    categoryOf: (entry) => entry.district,
  },
}).withSample((now) => [
  {
    id: 'sample-waste-1',
    date: sampleInstant(now, { days: 2, hour: 6 }),
    wasteType: 'restmuell',
    district: 'Bezirk A',
  },
  {
    id: 'sample-waste-2',
    date: sampleInstant(now, { days: 4, hour: 6 }),
    wasteType: 'papier',
    district: 'Bezirk A',
  },
  {
    id: 'sample-waste-3',
    date: sampleInstant(now, { days: 9, hour: 6 }),
    wasteType: 'biomuell',
    district: 'Bezirk A',
  },
  {
    id: 'sample-waste-4',
    date: sampleInstant(now, { days: 12, hour: 6 }),
    wasteType: 'gelberSack',
    district: 'Bezirk A',
  },
]);
