import { email, optional, text } from '../models/field-schema';

import { CONTENT_LIMITS as LIMITS } from './content-limits';
import { defineContent } from './define-content';
import { label, recordId, title } from './shared-fields';

/** A contact person. */
export const contactContent = defineContent({
  shape: {
    id: recordId(),
    name: title(),
    role: label(),
    email: optional(email(LIMITS.label)),
    phone: optional(text({ max: LIMITS.phone })),
  },
  rule: {},
}).withSample(() => [
  {
    id: 'sample-contact-1',
    name: 'Maria Beispiel',
    role: 'Bürgermeisterin',
    email: 'maria.beispiel@example.org',
    phone: '07541 123-100',
  },
  {
    id: 'sample-contact-2',
    name: 'Jonas Muster',
    role: 'Leiter Bürgerbüro',
    email: 'jonas.muster@example.org',
    phone: '07541 123-200',
  },
  {
    id: 'sample-contact-3',
    name: 'Eva Probst',
    role: 'Pressestelle',
    email: 'eva.probst@example.org',
  },
]);
