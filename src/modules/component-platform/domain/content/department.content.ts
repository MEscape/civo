import { email, list, object, optional } from '../models/field-schema';

import { CONTENT_LIMITS as LIMITS } from './content-limits';
import { defineContent } from './define-content';
import { optionalLinkTarget, recordId, shortText, title } from './shared-fields';

/** A department with its contact persons. */
export const departmentContent = defineContent({
  shape: {
    id: recordId(),
    name: title(),
    description: shortText(),
    href: optionalLinkTarget(),
    contacts: list(
      object({
        id: recordId(),
        name: title(),
        email: optional(email(LIMITS.label)),
      }),
      LIMITS.contacts,
    ),
  },
  rule: {},
}).withSample(() => [
  {
    id: 'sample-department-1',
    name: 'Bürgerbüro',
    description: 'Meldewesen, Ausweise und Bescheinigungen.',
    href: '/aemter/buergerbuero',
    contacts: [
      {
        id: 'sample-dc-1',
        name: 'Jonas Muster',
        email: 'buergerbuero@example.org',
      },
      { id: 'sample-dc-2', name: 'Lena Beispiel' },
    ],
  },
  {
    id: 'sample-department-2',
    name: 'Bauamt',
    description: 'Baugenehmigungen und Stadtplanung.',
    contacts: [{ id: 'sample-dc-3', name: 'Karl Beispiel', email: 'bauamt@example.org' }],
  },
]);
