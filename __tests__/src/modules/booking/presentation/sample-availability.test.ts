import { describe, expect, it } from 'vitest';

import { createPreviewHold } from '@modules/booking/presentation/flow/preview-hold';
import { createSampleAvailability } from '@modules/booking/presentation/time/sample-availability';

const QUERY = {
  serviceId: 'sample-id-card',
  locationId: 'sample-location',
  timeZone: 'Europe/Berlin',
  durationMinutes: 20,
  from: '2026-10-09',
  to: '2026-10-18',
  now: new Date('2026-10-09T12:00:00Z'),
} as const;

describe('createSampleAvailability', () => {
  const { slots } = createSampleAvailability(QUERY);

  it('offers times only on weekdays, in the location zone', () => {
    const dates = [...new Set(slots.map((slot) => slot.localDate))];

    expect(dates).toEqual([
      '2026-10-09',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
    ]);
    expect(slots.find((slot) => slot.localDate === '2026-10-12')?.localTime).toBe('09:00');
  });

  it('never offers a time that has already passed', () => {
    // 12:00 UTC is 14:00 in Berlin: the morning of the 9th is gone, and 14:00 itself is no longer in the future.
    const today = slots
      .filter((slot) => slot.localDate === '2026-10-09')
      .map((slot) => slot.localTime);

    expect(today[0]).toBe('14:30');
  });

  it('ends every time one service duration after it starts', () => {
    for (const slot of slots) {
      expect(Date.parse(slot.end) - Date.parse(slot.start)).toBe(20 * 60_000);
    }
  });

  it('answers an unknown zone or a malformed range with no times instead of failing', () => {
    expect(createSampleAvailability({ ...QUERY, timeZone: 'Not/AZone' }).slots).toEqual([]);
    expect(createSampleAvailability({ ...QUERY, from: 'soon' }).slots).toEqual([]);
  });
});

describe('createPreviewHold', () => {
  it('describes the chosen time without any server involvement and outlives a visit', () => {
    const slot = createSampleAvailability(QUERY).slots[0];
    if (slot === undefined) {
      throw new Error('expected a sample slot');
    }
    const now = new Date('2026-10-09T12:00:00Z');
    const hold = createPreviewHold({
      slot,
      timeZone: 'Europe/Berlin',
      participants: 2,
      serviceName: 'ID card',
      locationName: 'Town hall',
      now,
    });

    expect(hold).toMatchObject({ start: slot.start, participants: 2, serviceName: 'ID card' });
    expect(Date.parse(hold.expiresAt) - now.getTime()).toBeGreaterThanOrEqual(60 * 60_000);
  });
});
