import { instant } from '../models/field-schema';

import { defineContent } from './define-content';
import { sampleInstant } from './sample-instant';
import { compareText, imageUrl, label, recordId, shortText, title } from './shared-fields';

/** A news article of the municipality, newest first. */
export const newsItemContent = defineContent({
  shape: {
    id: recordId(),
    title: title(),
    excerpt: shortText(),
    category: label(),
    imageUrl: imageUrl(),
    publishedAt: instant(),
  },
  rule: {
    compare: (first, second) => compareText(second.publishedAt, first.publishedAt),
    categoryOf: (item) => item.category,
  },
}).withSample((now) => [
  {
    id: 'sample-news-1',
    title: 'Neuer Radweg entlang der Hauptstraße eröffnet',
    excerpt: 'Der Radweg verbindet jetzt Innenstadt und Bahnhof auf direktem Weg.',
    category: 'Mobilität',
    publishedAt: sampleInstant(now, { days: -1, hour: 9 }),
  },
  {
    id: 'sample-news-2',
    title: 'Sanierung des Freibads beginnt im Herbst',
    excerpt: 'Die Arbeiten dauern voraussichtlich bis zum Saisonstart im Mai.',
    category: 'Bauen',
    publishedAt: sampleInstant(now, { days: -3, hour: 14 }),
  },
  {
    id: 'sample-news-3',
    title: 'Anmeldung für die Ferienbetreuung gestartet',
    category: 'Familie',
    publishedAt: sampleInstant(now, { days: -6, hour: 8 }),
  },
]);
