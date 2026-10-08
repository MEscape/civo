import { list, object } from '../models/field-schema';

import { CONTENT_LIMITS as LIMITS } from './content-limits';
import { defineContent } from './define-content';
import { label, recordId, shortText, title } from './shared-fields';

/** A council or committee with its members. */
export const councilBodyContent = defineContent({
  shape: {
    id: recordId(),
    name: title(),
    description: shortText(),
    members: list(
      object({ id: recordId(), name: title(), role: label(), party: label() }),
      LIMITS.members,
    ),
  },
  rule: {},
}).withSample(() => [
  {
    id: 'sample-body-1',
    name: 'Gemeinderat',
    description: 'Das oberste Gremium der Gemeinde.',
    members: [
      {
        id: 'sample-member-1',
        name: 'Maria Beispiel',
        role: 'Vorsitz',
        party: 'Freie Wähler',
      },
      {
        id: 'sample-member-2',
        name: 'Jonas Muster',
        role: 'Stellvertretung',
        party: 'SPD',
      },
      { id: 'sample-member-3', name: 'Eva Probst', party: 'Grüne' },
    ],
  },
  {
    id: 'sample-body-2',
    name: 'Bauausschuss',
    members: [
      {
        id: 'sample-member-4',
        name: 'Karl Beispiel',
        role: 'Vorsitz',
        party: 'CDU',
      },
      { id: 'sample-member-5', name: 'Anna Muster' },
    ],
  },
]);
