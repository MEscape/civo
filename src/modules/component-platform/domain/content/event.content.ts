import { instant, optional } from '../models/field-schema';

import { defineContent } from './define-content';
import { sampleInstant } from './sample-instant';
import { compareText, imageUrl, label, longText, recordId, title } from './shared-fields';

/** An event on the municipal calendar. */
export const eventContent = defineContent({
  shape: {
    id: recordId(),
    title: title(),
    description: longText(),
    startDate: instant(),
    endDate: optional(instant()),
    location: label(),
    category: label(),
    imageUrl: imageUrl(),
  },
  rule: {
    isRelevant: (event, now) => (event.endDate ?? event.startDate) >= now,
    compare: (first, second) => compareText(first.startDate, second.startDate),
    categoryOf: (event) => event.category,
  },
}).withSample((now) => [
  {
    id: 'sample-event-1',
    title: 'Sitzung des Gemeinderats',
    startDate: sampleInstant(now, { days: 3, hour: 17 }),
    endDate: sampleInstant(now, { days: 3, hour: 19 }),
    location: 'Rathaus, Sitzungssaal',
    category: 'Politik',
  },
  {
    id: 'sample-event-2',
    title: 'Wochenmarkt auf dem Marktplatz',
    startDate: sampleInstant(now, { days: 6, hour: 7 }),
    endDate: sampleInstant(now, { days: 6, hour: 12 }),
    location: 'Marktplatz',
    category: 'Markt',
  },
  {
    id: 'sample-event-3',
    title: 'Stadtfest',
    description: 'Musik, Essen und Programm für die ganze Familie.',
    startDate: sampleInstant(now, { days: 20, hour: 10 }),
    location: 'Innenstadt',
    category: 'Kultur',
  },
]);
