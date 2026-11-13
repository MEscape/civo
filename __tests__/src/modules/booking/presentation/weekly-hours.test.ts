import { describe, expect, it } from 'vitest';

import type { DayDto } from '@modules/booking/client';
import {
  CLOSED_DAY,
  addBreak,
  addInterval,
  copyDay,
  removeBreak,
  removeInterval,
  updateDay,
} from '@modules/booking/presentation/forms/week/draft';
import { dayFacts } from '@modules/booking/presentation/forms/week/facts';
import { summarizeWeek } from '@modules/booking/presentation/forms/week/summary';
import {
  WEEK_TEMPLATES,
  WEEK_TEMPLATE_KEYS,
  changedDays,
} from '@modules/booking/presentation/forms/week/templates';
import { formatRanges, minutesOf, timeOf } from '@modules/booking/presentation/forms/week/time';
import { dayMinutes, weekMinutes } from '@modules/booking/presentation/forms/week/totals';

const OFFICE = WEEK_TEMPLATES.standardOffice;

describe('reading times', () => {
  it.each([
    ['00:00', 0],
    ['08:30', 510],
    ['24:00', 1440],
  ])('reads %s as %i minutes', (text, minutes) => {
    expect(minutesOf(text)).toBe(minutes);
    expect(timeOf(minutes)).toBe(text);
  });

  it.each(['', '8:30', '08:60', '24:01', 'noon', '08:30:00'])('does not read "%s"', (text) => {
    expect(minutesOf(text)).toBeNull();
  });
});

describe('the weekly total', () => {
  it('is computed from the hours, never typed: the office week is 44 hours, not the 38 a mock-up claimed', () => {
    // Monday to Thursday 08:00-18:00 less an hour's break is 9 hours; Friday 08:00-16:00 is 8.
    expect(dayMinutes(OFFICE[0])).toBe(9 * 60);
    expect(dayMinutes(OFFICE[4])).toBe(8 * 60);
    expect(weekMinutes(OFFICE)).toBe(44 * 60);
  });

  it('follows an edit at once', () => {
    const shorter = updateDay(OFFICE, 4, (day) => ({
      ...day,
      intervals: [{ start: '08:00', end: '14:00' }],
    }));

    expect(weekMinutes(shorter)).toBe(42 * 60);
  });

  it('counts a range that does not read as nothing, and never goes below zero', () => {
    const odd: DayDto = {
      intervals: [
        { start: '10:00', end: '09:00' },
        { start: 'x', end: '12:00' },
      ],
      breaks: [{ start: '09:00', end: '10:00' }],
    };

    expect(dayMinutes(odd)).toBe(0);
    expect(weekMinutes([odd])).toBe(0);
    expect(weekMinutes([])).toBe(0);
  });

  it('counts several ranges and breaks of a day', () => {
    const split: DayDto = {
      intervals: [
        { start: '08:00', end: '12:00' },
        { start: '13:00', end: '17:00' },
      ],
      breaks: [{ start: '10:00', end: '10:15' }],
    };

    expect(dayMinutes(split)).toBe(8 * 60 - 15);
  });
});

describe('editing a day', () => {
  it('adds a working day when there is none, and a blank row to fill in when there is one', () => {
    const first = addInterval(CLOSED_DAY);
    const second = addInterval(first);

    expect(first.intervals).toEqual([{ start: '08:00', end: '17:00' }]);
    expect(second.intervals).toEqual([
      { start: '08:00', end: '17:00' },
      { start: '', end: '' },
    ]);
  });

  it('adds a break at noon, and removes ranges and breaks by position', () => {
    const withBreak = addBreak(CLOSED_DAY);
    expect(withBreak.breaks).toEqual([{ start: '12:00', end: '13:00' }]);
    expect(removeBreak(withBreak, 0).breaks).toEqual([]);
    expect(removeInterval(OFFICE[0], 0).intervals).toEqual([]);
    expect(removeInterval(OFFICE[0], 5)).toEqual(OFFICE[0]);
  });

  it('puts a new break inside the open hours, so it is never refused for lying outside them', () => {
    const morning = { intervals: [{ start: '08:00', end: '12:00' }], breaks: [] };
    expect(addBreak(morning).breaks).toEqual([{ start: '09:45', end: '10:15' }]);
    const long = { intervals: [{ start: '07:00', end: '19:00' }], breaks: [] };
    expect(addBreak(long).breaks).toEqual([{ start: '12:00', end: '13:00' }]);
    const split = {
      intervals: [
        { start: '08:00', end: '10:00' },
        { start: '14:00', end: '18:00' },
      ],
      breaks: [],
    };
    expect(addBreak(split).breaks).toEqual([{ start: '15:45', end: '16:15' }]);
  });

  it('changes only the day asked for', () => {
    const next = updateDay(OFFICE, 2, () => CLOSED_DAY);

    expect(next[2]).toEqual(CLOSED_DAY);
    expect(next[1]).toBe(OFFICE[1]);
    expect(next).toHaveLength(7);
  });

  it('copies a day to the days chosen, not to itself and not to the rest', () => {
    const next = copyDay(OFFICE, 0, [0, 5, 6]);

    expect(next[5]).toEqual(OFFICE[0]);
    expect(next[6]).toEqual(OFFICE[0]);
    expect(next[4]).toBe(OFFICE[4]);
    expect(copyDay(OFFICE, 9, [1])).toEqual(OFFICE);
  });
});

describe('templates', () => {
  it('are whole weeks of seven days', () => {
    for (const key of WEEK_TEMPLATE_KEYS) {
      expect(WEEK_TEMPLATES[key]).toHaveLength(7);
    }
  });

  it('show what choosing them would change before it is applied', () => {
    const changes = changedDays(OFFICE, WEEK_TEMPLATES.mornings);

    expect(changes.map(({ weekday }) => weekday)).toEqual([0, 1, 2, 3, 4]);
    expect(formatRanges(changes[0]?.before.intervals ?? [])).toBe('08:00–18:00');
    expect(formatRanges(changes[0]?.after.intervals ?? [])).toBe('08:00–12:00');
  });

  it('change nothing when the week already is the template, whatever order the rows are in', () => {
    const reversed = OFFICE.map((day) => ({
      intervals: [...day.intervals].reverse(),
      breaks: [...day.breaks].reverse(),
    }));

    expect(changedDays(OFFICE, OFFICE)).toEqual([]);
    expect(changedDays(OFFICE, reversed)).toEqual([]);
  });

  it('close the whole week with the closed template', () => {
    expect(weekMinutes(WEEK_TEMPLATES.closed)).toBe(0);
    expect(changedDays(OFFICE, WEEK_TEMPLATES.closed)).toHaveLength(5);
  });
});

describe('what a change means in words', () => {
  const fridayUntil14 = updateDay(OFFICE, 4, (day) => ({
    ...day,
    intervals: [{ start: '08:00', end: '14:00' }],
  }));

  it('says Friday closes at 14:00 instead of 16:00, from the data', () => {
    expect(dayFacts(OFFICE, fridayUntil14)).toEqual([
      { weekday: 4, kind: 'closesEarlier', from: '16:00', to: '14:00' },
    ]);
  });

  it('says when a day opens or closes later or earlier', () => {
    const next = updateDay(
      updateDay(OFFICE, 0, (day) => ({ ...day, intervals: [{ start: '09:00', end: '19:00' }] })),
      1,
      (day) => ({ ...day, intervals: [{ start: '07:00', end: '18:00' }] }),
    );

    expect(dayFacts(OFFICE, next)).toEqual([
      { weekday: 0, kind: 'opensLater', from: '08:00', to: '09:00' },
      { weekday: 0, kind: 'closesLater', from: '18:00', to: '19:00' },
      { weekday: 1, kind: 'opensEarlier', from: '08:00', to: '07:00' },
    ]);
  });

  it('says when a day comes or goes', () => {
    const next = updateDay(
      updateDay(OFFICE, 0, () => CLOSED_DAY),
      5,
      () => ({
        intervals: [{ start: '10:00', end: '14:00' }],
        breaks: [],
      }),
    );

    expect(dayFacts(OFFICE, next)).toEqual([
      { weekday: 0, kind: 'closed' },
      { weekday: 5, kind: 'opened', to: '10:00–14:00' },
    ]);
  });

  it('says "other" when only the breaks changed, and nothing when nothing did', () => {
    const noBreak = updateDay(OFFICE, 0, (day) => ({ ...day, breaks: [] }));

    expect(dayFacts(OFFICE, noBreak)).toEqual([{ weekday: 0, kind: 'other' }]);
    expect(dayFacts(OFFICE, OFFICE)).toEqual([]);
  });
});

describe('summarizing a week', () => {
  const texts = {
    none: 'closed all week',
    day: (index: number) => ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'][index] ?? '?',
    range: (from: string, to: string) => `${from}-${to}`,
    group: (days: string, hours: string) => `${days} ${hours}`,
    withBreak: (hours: string, breaks: string) => `${hours} (break ${breaks})`,
    total: (hours: number, minutes: number) => `${hours}h${minutes}`,
  };

  it('joins runs of days with the same hours, and ends with the total', () => {
    expect(summarizeWeek(OFFICE, texts)).toEqual([
      'Mo-Th 08:00–18:00 (break 12:00–13:00)',
      'Fr 08:00–16:00',
      '44h0',
    ]);
  });

  it('does not join days that are not neighbours', () => {
    const gap = updateDay(OFFICE, 2, () => CLOSED_DAY);

    expect(summarizeWeek(gap, texts).slice(0, 2)).toEqual([
      'Mo-Tu 08:00–18:00 (break 12:00–13:00)',
      'Th 08:00–18:00 (break 12:00–13:00)',
    ]);
  });

  it('says so when no day is open', () => {
    expect(summarizeWeek(WEEK_TEMPLATES.closed, texts)).toEqual(['closed all week']);
  });
});
