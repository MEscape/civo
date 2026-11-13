import { describe, expect, it } from 'vitest';

import { isBookingSetupComplete } from '@modules/booking/presentation/forms/setup-complete';

const FULL = { locations: 1, services: 2, resources: 1, team: 1 };

describe('whether the booking setup is finished', () => {
  it('is finished only with a location, services, resources and a team', () => {
    expect(isBookingSetupComplete(FULL)).toBe(true);
  });

  it.each(['locations', 'services', 'resources', 'team'] as const)(
    'is not finished while there is no %s, so no list calls booking done before the guide does',
    (missing) => {
      expect(isBookingSetupComplete({ ...FULL, [missing]: 0 })).toBe(false);
    },
  );
});
