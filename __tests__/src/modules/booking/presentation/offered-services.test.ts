import { describe, expect, it } from 'vitest';

import type { AdoptableServiceDto } from '@modules/booking/client';
import { groupOffered } from '@modules/booking/presentation/forms/offered-services';
import { wizardStepsFor } from '@modules/booking/presentation/forms/wizard-steps';

const service = (id: string, category: string | null): AdoptableServiceDto => ({
  id,
  name: id,
  category,
  durationMinutes: 20,
  source: { id: 'loc-a', name: 'Mitte' },
});

describe('the services a new location could take over', () => {
  it('groups them by category, those without one last', () => {
    const groups = groupOffered(
      [
        service('c', null),
        service('b', 'Meldewesen'),
        service('a', 'Ausweise'),
        service('d', 'Ausweise'),
      ],
      'No category',
    );

    expect(groups.map((group) => group.label)).toEqual(['Ausweise', 'Meldewesen', 'No category']);
    expect(groups[0]?.items.map((item) => item.id)).toEqual(['a', 'd']);
  });

  it('has a services step only where there is something to take over', () => {
    expect(wizardStepsFor(true)).toContain('services');
    expect(wizardStepsFor(false)).toEqual(['basics', 'hours', 'exceptions', 'review']);
  });
});
