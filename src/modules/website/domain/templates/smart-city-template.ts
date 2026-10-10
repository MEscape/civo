import { HOME_PAGE_TITLE, component, section } from './blueprint-builders';

import type { WebsiteTemplate } from '../models/website-template';

export const smartCityTemplate: WebsiteTemplate = {
  key: 'smart-city',
  homePage: {
    title: HOME_PAGE_TITLE,
    nodes: [
      component('hero', 'hero', {
        title: 'Musterstadt Smart City',
        subtitle: 'Daten und Fortschritt für eine lebenswerte Stadt',
      }),
      section('overview', 'default', [
        component('dashboardGrid', 'dashboard', { heading: 'Stadt in Zahlen' }),
      ]),
      section('metrics', 'muted', [
        component('kpiGrid', 'kpis', {
          columns: 3,
          heading: 'Aktuelle Kennzahlen',
        }),
        component('metricTrendChart', 'trend', { heading: 'Entwicklung' }),
      ]),
      section('about-data', 'muted', [
        component('accordion', 'data-faq', {
          heading: 'Über die Daten',
          items: [
            {
              question: 'Woher stammen die Daten?',
              answer: 'Die Kennzahlen kommen aus den Fachverfahren und Sensoren der Stadt.',
            },
            {
              question: 'Wie aktuell sind die Werte?',
              answer: 'Jede Kennzahl zeigt den Zeitpunkt der letzten Messung an.',
            },
          ],
        }),
      ]),
      section('projects', 'default', [
        component('newsGrid', 'news', {
          columns: 3,
          limit: 3,
          heading: 'Aktuelle Projekte',
        }),
      ]),
    ],
  },
};
