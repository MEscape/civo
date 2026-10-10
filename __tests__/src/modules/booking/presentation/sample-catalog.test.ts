import { describe, expect, it } from 'vitest';

import { createSampleCatalog } from '@modules/booking/presentation/dto/sample-catalog-dto';
import deBooking from '@modules/booking/presentation/i18n/de.json';
import enBooking from '@modules/booking/presentation/i18n/en.json';

const TEXTS = {
  idCard: { name: 'ID card', description: 'Apply for an ID card.', category: 'Citizen services' },
  registration: {
    name: 'Registration',
    description: 'Register a new address.',
    category: 'Citizen services',
  },
  location: { name: 'Citizens office', address: 'Town hall' },
  instructions: 'Bring your ID.',
} as const;

describe('createSampleCatalog', () => {
  const catalog = createSampleCatalog(TEXTS);

  it('offers two services so the editor sees a service step with a real choice', () => {
    expect(catalog.services.map((service) => service.name)).toEqual(['ID card', 'Registration']);
  });

  it('gives every service a location, a duration and a way to book', () => {
    for (const service of catalog.services) {
      expect(service.locations).toHaveLength(1);
      expect(service.durationMinutes).toBeGreaterThan(0);
      expect(service.information.map((entry) => entry.field)).toContain('email');
    }
  });

  it('uses unique ids that can never equal a stored service id', () => {
    const ids = catalog.services.map((service) => service.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('sample-'))).toBe(true);
  });

  it('is translated in both locales, so the sample is not hard-coded text', () => {
    for (const messages of [enBooking, deBooking]) {
      const { sample } = messages.booking;
      expect(sample.idCard.name).not.toBe('');
      expect(sample.location.address).not.toBe('');
      expect(sample.instructions).not.toBe('');
    }
    expect(enBooking.booking.sample.idCard.name).not.toBe(deBooking.booking.sample.idCard.name);
  });
});
