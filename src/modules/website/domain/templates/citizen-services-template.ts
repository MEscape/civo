import { HOME_PAGE_TITLE, component, section } from './blueprint-builders';

import type { WebsiteTemplate } from '../models/website-template';

/** Service-first: find a matter, book an appointment, read the answers, then reach a person. */
export const citizenServicesTemplate: WebsiteTemplate = {
  key: 'citizen-services',
  homePage: {
    title: HOME_PAGE_TITLE,
    nodes: [
      component('hero', 'hero', {
        title: 'Bürgerservice online',
        subtitle: 'Anliegen finden, Termin buchen, Wartezeit sparen',
      }),
      section('find', 'default', [
        component('serviceFinder', 'service-finder', {
          heading: 'Welches Anliegen haben Sie?',
          placeholder: 'z. B. Personalausweis, Umzug, Parkausweis',
        }),
        component('serviceGrid', 'service-grid', { heading: 'Häufig genutzte Leistungen' }),
      ]),
      section('appointments', 'muted', [
        component('booking', 'booking', { heading: 'Termin vereinbaren' }),
      ]),
      section('help', 'default', [
        component('accordion', 'faq', {
          heading: 'Häufige Fragen',
          items: [
            {
              question: 'Muss ich einen Termin vereinbaren?',
              answer:
                'Für die meisten Anliegen empfehlen wir einen Termin. Er verkürzt Ihre Wartezeit erheblich.',
            },
            {
              question: 'Welche Unterlagen muss ich mitbringen?',
              answer:
                'Die benötigten Unterlagen stehen bei jeder Leistung und in Ihrer Terminbestätigung.',
            },
            {
              question: 'Wie kann ich meinen Termin ändern oder absagen?',
              answer:
                'Über den Link in Ihrer Bestätigungs-E-Mail können Sie den Termin selbst verschieben oder stornieren.',
            },
          ],
        }),
      ]),
      section('contact', 'muted', [
        component('contactCard', 'contact-card', { heading: 'Persönlich erreichen' }),
        component('openingHours', 'opening-hours', { heading: 'Öffnungszeiten' }),
      ]),
    ],
  },
};
