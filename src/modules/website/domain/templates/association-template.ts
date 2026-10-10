import { HOME_PAGE_TITLE, component, section } from './blueprint-builders';

import type { WebsiteTemplate } from '../models/website-template';

export const associationTemplate: WebsiteTemplate = {
  key: 'association',
  homePage: {
    title: HOME_PAGE_TITLE,
    nodes: [
      component('hero', 'hero', {
        title: 'Willkommen bei unserem Verein',
        subtitle: 'Gemeinsam aktiv seit vielen Jahren',
      }),
      section('about', 'default', [
        component('richText', 'about-text', {
          heading: 'Über uns',
          body: 'Hier steht eine kurze Vorstellung des Vereins, seiner Geschichte und seiner Ziele.',
        }),
        component('quickLinks', 'quick-links', { heading: 'Wichtige Links' }),
      ]),
      section('news', 'muted', [
        component('newsAndEventsSplit', 'news-events', {
          heading: 'Aktuelles & Termine',
          newsLimit: 3,
          eventsLimit: 3,
        }),
      ]),
      component('callToAction', 'join', {
        heading: 'Mitglied werden',
        body: 'Machen Sie mit: Wir freuen uns über neue Gesichter und frische Ideen.',
        buttonLabel: 'Kontakt aufnehmen',
      }),
      section('contact', 'default', [
        component('contactCard', 'contact-card', { heading: 'Kontakt' }),
        component('openingHours', 'opening-hours', {
          heading: 'Öffnungszeiten Vereinsheim',
        }),
      ]),
    ],
  },
};
