import { describe, expect, it } from 'vitest';

import { weekOf } from '@modules/booking/presentation/forms/overview-week';

const booking = (
  start: string,
  assignment: 'open' | 'assigned',
  status: 'confirmed' | 'cancelled' | 'held' = 'confirmed',
) => ({ start, status, assignment });

describe('weekOf', () => {
  it('counts the confirmed bookings of each day by whether an employee is still wanted', () => {
    const week = weekOf(
      [
        booking('2026-11-04T09:00:00+01:00', 'assigned'),
        booking('2026-11-04T10:00:00+01:00', 'open'),
        booking('2026-11-06T09:00:00+01:00', 'open'),
      ],
      '2026-11-04',
    );
    expect(week).toHaveLength(7);
    expect(week[0]).toEqual({ day: '2026-11-04', waiting: 1, covered: 1 });
    expect(week[2]).toEqual({ day: '2026-11-06', waiting: 1, covered: 0 });
  });

  it('draws a day without bookings as zeros, so the chart always shows the whole week', () => {
    const week = weekOf([], '2026-11-04', 3);
    expect(week.map(({ day }) => day)).toEqual(['2026-11-04', '2026-11-05', '2026-11-06']);
    expect(week.every(({ waiting, covered }) => waiting === 0 && covered === 0)).toBe(true);
  });

  it('leaves out what is not work still ahead: held and cancelled bookings', () => {
    const week = weekOf(
      [
        booking('2026-11-04T09:00:00+01:00', 'open', 'cancelled'),
        booking('2026-11-04T09:30:00+01:00', 'open', 'held'),
      ],
      '2026-11-04',
    );
    expect(week[0]).toEqual({ day: '2026-11-04', waiting: 0, covered: 0 });
  });

  it('puts a booking on the day of its own location clock', () => {
    const week = weekOf([booking('2026-11-05T00:30:00+01:00', 'assigned')], '2026-11-04');
    expect(week[1]?.covered).toBe(1);
    expect(week[0]?.covered).toBe(0);
  });

  it('counts a day beyond the week for nobody', () => {
    const week = weekOf([booking('2026-12-24T09:00:00+01:00', 'assigned')], '2026-11-04');
    expect(week.reduce((sum, { covered }) => sum + covered, 0)).toBe(0);
  });
});
