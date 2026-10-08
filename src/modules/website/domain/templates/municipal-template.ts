import { HOME_PAGE_TITLE, component, section } from './blueprint-builders';

import type { WebsiteTemplate } from '../models/website-template';

export const municipalTemplate: WebsiteTemplate = {
  key: 'municipal',
  homePage: {
    title: HOME_PAGE_TITLE,
    nodes: [
      component('alertBanner', 'alert', { heading: 'Wichtige Mitteilung' }),
      component('hero', 'hero', {
        title: 'Willkommen in Musterstadt',
        subtitle: 'Gemeinsam digital gestalten',
      }),
      section('services', 'default', [
        component('serviceFinder', 'service-finder', {
          heading: 'Was erledige ich wo?',
          placeholder: 'Suchbegriff eingeben...',
        }),
        component('quickLinks', 'quick-links', { heading: 'Oft gesucht' }),
      ]),
      section('news', 'muted', [
        component('newsAndEventsSplit', 'news-events', {
          heading: 'Aktuelles aus der Stadt',
          newsLimit: 4,
          eventsLimit: 4,
        }),
      ]),
      section('directory', 'default', [
        component('departmentDirectory', 'directory', {
          heading: 'Ansprechpartner & Ämter',
        }),
        component('wasteCalendar', 'waste-calendar', {
          heading: 'Abfallkalender',
        }),
      ]),
      section('contact', 'muted', [
        component('contactCard', 'contact', { heading: 'Kontakt Rathaus' }),
        component('openingHours', 'opening-hours', {
          heading: 'Öffnungszeiten Bürgerbüro',
        }),
      ]),
    ],
  },
};
