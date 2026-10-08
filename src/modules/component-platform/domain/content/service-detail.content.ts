import { list, optional, text } from '../models/field-schema';

import { CONTENT_LIMITS as LIMITS } from './content-limits';
import { defineContent } from './define-content';
import { label, linkTarget, recordId, shortText, title } from './shared-fields';

/** A service with everything the searchable directory needs. */
export const serviceDetailContent = defineContent({
  shape: {
    id: recordId(),
    title: title(),
    description: shortText(),
    href: linkTarget(),
    icon: optional(text({ max: LIMITS.label })),
    category: label(),
    department: label(),
    processingNote: label(),
    keywords: optional(list(text({ min: 1, max: LIMITS.label }), LIMITS.keywords)),
  },
  rule: {
    categoryOf: (service) => service.category,
  },
}).withSample(() => [
  {
    id: 'sample-detail-1',
    title: 'Personalausweis beantragen',
    description: 'Neuer Ausweis oder Verlängerung.',
    href: '/leistungen/personalausweis',
    category: 'Bürgerservice',
    department: 'Bürgerbüro',
    processingNote: 'ca. 3 Wochen',
    keywords: ['Ausweis', 'Identität'],
  },
  {
    id: 'sample-detail-2',
    title: 'Baugenehmigung',
    description: 'Antrag auf Genehmigung eines Bauvorhabens.',
    href: '/leistungen/baugenehmigung',
    category: 'Bauen',
    department: 'Bauamt',
    keywords: ['Bauantrag', 'Neubau'],
  },
  {
    id: 'sample-detail-3',
    title: 'Hund anmelden',
    href: '/leistungen/hundesteuer',
    category: 'Steuern',
  },
]);
