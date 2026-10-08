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
