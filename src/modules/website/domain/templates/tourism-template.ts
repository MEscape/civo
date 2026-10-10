import { HOME_PAGE_TITLE, component, section } from './blueprint-builders';

import type { WebsiteTemplate } from '../models/website-template';

/** Visitor-first: inspire with highlights, show what is on, then help plan the trip. */
export const tourismTemplate: WebsiteTemplate = {
  key: 'tourism',
  homePage: {
    title: HOME_PAGE_TITLE,
    nodes: [
      component('hero', 'hero', {
        title: 'Entdecken Sie Musterstadt',
        subtitle: 'Natur, Kultur und Genuss an einem Ort',
      }),
      section('highlights', 'default', [
        component('cardGrid', 'highlight-cards', {
          heading: 'Unsere Highlights',
          cards: [
            {
              title: 'Altstadt',
              description: 'Historische Gassen, Cafés und Märkte zum Bummeln.',
            },
            {
              title: 'Natur & Wandern',
              description: 'Markierte Wege durch Wald, Wiesen und entlang des Flusses.',
            },
            {
              title: 'Museen & Kultur',
              description: 'Ausstellungen, Führungen und Konzerte das ganze Jahr.',
            },
          ],
        }),
      ]),
      section('events', 'muted', [
        component('eventsGrid', 'events-grid', { heading: 'Veranstaltungen', limit: 6 }),
      ]),
      component('callToAction', 'plan-visit', {
        heading: 'Planen Sie Ihren Besuch',
        body: 'Anreise, Unterkünfte und Tipps der Tourist-Information auf einen Blick.',
        buttonLabel: 'Zur Tourist-Information',
      }),
      section('info', 'default', [
        component('quickLinks', 'quick-links', { heading: 'Gut zu wissen' }),
        component('contactCard', 'contact-card', { heading: 'Tourist-Information' }),
        component('openingHours', 'opening-hours', { heading: 'Öffnungszeiten' }),
      ]),
    ],
  },
};
