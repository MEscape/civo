import { describe, expect, it } from 'vitest';

import { toBookableResourceId } from '@modules/booking/domain/models/ids';
import {
  alternativeRange,
  suggestAlternativeSlots,
} from '@modules/booking/domain/scheduling/alternative-slots';
import { matchResources } from '@modules/booking/domain/scheduling/resource-matching';

import {
  BERLIN,
  at,
  indexFor,
  makeBooking,
  makeLocation,
  plan,
  times,
  weekdays,
} from '../support/fixtures';

const id = toBookableResourceId;

describe('resource matching', () => {
  it('fills every demand with a different resource', () => {
    const result = matchResources([
      { candidates: [id('a'), id('b')] },
      { candidates: [id('a'), id('b')] },
    ]);
    expect(result === null ? [] : [...result].sort()).toEqual(['a', 'b']);
  });

  it('reassigns an earlier choice when a later demand needs it', () => {
    // Demand 1 prefers a, but demand 2 can only use a: b must go to demand 1.
    const result = matchResources([{ candidates: [id('a'), id('b')] }, { candidates: [id('a')] }]);
    expect(result === null ? [] : [...result].sort()).toEqual(['a', 'b']);
  });

  it('fails when there are more demands than resources', () => {
    expect(matchResources([{ candidates: [id('a')] }, { candidates: [id('a')] }])).toBeNull();
  });

  it('fails when a demand has no candidates', () => {
    expect(matchResources([{ candidates: [] }])).toBeNull();
  });

  it('succeeds trivially with no demands', () => {
    expect(matchResources([])).toEqual([]);
  });
});

describe('alternative slots', () => {
  const MONDAY = '2027-01-11';
  const location = makeLocation({ openingHours: weekdays('09:00', '12:00') });

  function suggest(bookingStarts: number[], limit = 4) {
    const bookings = bookingStarts.map((start) => makeBooking({ start, resources: ['emp-1'] }));
    const requested = at(MONDAY, '10:00');
    const index = indexFor({ location, bookings }, alternativeRange(requested, BERLIN, 2));
    return suggestAlternativeSlots(index, { requestedStart: requested, participants: 1, limit });
  }

  it('prefers the same day, nearest in time first', () => {
    const slots = suggest([at(MONDAY, '10:00')]);
    expect(times(slots)).toEqual(['09:30', '10:30', '09:00', '11:00']);
  });

  it('moves to neighbouring days when the day is full', () => {
    const full = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'].map((time) =>
      at(MONDAY, time),
    );
    const slots = suggest(full, 3);
    const days = slots.map((slot) => new Date(slot.start).toISOString().slice(0, 10));
    expect(days.every((day) => day !== '2027-01-11')).toBe(true);
    // The same time of day on the nearest open day comes first (the weekend before is closed).
    expect(times(slots)[0]).toBe('10:00');
    expect(days[0]).toBe('2027-01-12');
  });

  it('never offers the requested time itself', () => {
    const slots = suggest([]);
    expect(slots.map((slot) => slot.start)).not.toContain(at(MONDAY, '10:00'));
  });

  it('is deterministic', () => {
    expect(suggest([at(MONDAY, '10:00')])).toEqual(suggest([at(MONDAY, '10:00')]));
  });

  it('returns nothing when nothing is free', () => {
    const none = indexFor({ location: makeLocation({ openingHours: plan({}) }) });
    expect(
      suggestAlternativeSlots(none, {
        requestedStart: at(MONDAY, '10:00'),
        participants: 1,
        limit: 3,
      }),
    ).toEqual([]);
  });

  it('respects the limit', () => {
    expect(suggest([], 2)).toHaveLength(2);
    expect(suggest([], 0)).toHaveLength(0);
  });
});
