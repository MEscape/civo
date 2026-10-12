import { instant, mappedOneOf } from '../../models/field-schema';
import { defineContent } from '../define-content';
import { sampleInstant } from '../sample-instant';
import { compareText, label, recordId } from '../shared-fields';

export const WASTE_TYPES = ['restmuell', 'biomuell', 'papier', 'gelberSack', 'sperrmuell'] as const;

export const WASTE_TYPE_ALIASES: Readonly<Record<string, (typeof WASTE_TYPES)[number]>> = {
  restmüll: 'restmuell',
  restabfall: 'restmuell',
  'graue tonne': 'restmuell',
  'schwarze tonne': 'restmuell',
  biomüll: 'biomuell',
  bioabfall: 'biomuell',
  'braune tonne': 'biomuell',
  grüngut: 'biomuell',
  papier: 'papier',
  altpapier: 'papier',
  papiertonne: 'papier',
  'blaue tonne': 'papier',
  'gelber sack': 'gelberSack',
  'gelbe tonne': 'gelberSack',
  'gelbe säcke': 'gelberSack',
  wertstoff: 'gelberSack',
  wertstoffmobil: 'gelberSack',
  recycling: 'gelberSack',
  sperrmüll: 'sperrmuell',
  sperrgut: 'sperrmuell',
};

const DATE_LENGTH = 10;

/**
 * One collection date. A date is relevant from the start of its day, so
 * today's collection still shows. The waste type accepts canonical keys or
 * common municipal aliases (e.g. 'Bioabfall', 'Gelbe Säcke', 'Wertstoffmobil').
 * The `district` is the category, so a component can filter on it.
 */
export const wasteCollectionEntryContent = defineContent({
  shape: {
    id: recordId(),
    date: instant(),
    wasteType: mappedOneOf(WASTE_TYPES, WASTE_TYPE_ALIASES),
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
