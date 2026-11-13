import { describe, expect, it } from 'vitest';

import {
  MISSING_VALUE,
  createZonedFormat,
} from '@modules/booking/presentation/hooks/use-zoned-format';

const BERLIN = 'Europe/Berlin';
const de = createZonedFormat('de');

describe('time in a stated zone', () => {
  it('reads one instant on the wall clock of whichever zone is asked for', () => {
    expect(de.time('2027-06-01T08:00:00Z', BERLIN)).toBe('10:00');
    expect(de.time('2027-06-01T08:00:00Z', 'America/Sao_Paulo')).toBe('05:00');
    expect(de.time('2027-06-01T08:00:00+00:00', 'Asia/Kolkata')).toBe('13:30');
  });

  it('does not depend on the offset the text happens to carry', () => {
    expect(de.time('2027-06-01T10:00:00+02:00', BERLIN)).toBe('10:00');
    expect(de.time('2027-06-01T10:00:00+02:00', 'Europe/London')).toBe('09:00');
  });

  it('uses the offset in force at each instant across the spring change (02:30 does not exist)', () => {
    expect(de.time('2027-03-27T23:30:00Z', BERLIN)).toBe('00:30');
    expect(de.time('2027-03-28T01:30:00Z', BERLIN)).toBe('03:30');
  });

  it('shows the repeated autumn hour twice and tells the two apart by the zone name', () => {
    const first = '2027-10-31T00:30:00Z';
    const second = '2027-10-31T01:30:00Z';

    expect(de.time(first, BERLIN)).toBe('02:30');
    expect(de.time(second, BERLIN)).toBe('02:30');
    expect(de.zoneName(first, BERLIN)).toBe('MESZ');
    expect(de.zoneName(second, BERLIN)).toBe('MEZ');
  });

  it('formats a range as start and exclusive end', () => {
    expect(de.timeRange('2027-06-01T09:45:00+02:00', '2027-06-01T10:15:00+02:00', BERLIN)).toBe(
      '09:45–10:15',
    );
  });
});

describe('dates in a stated zone', () => {
  it('puts an instant on the calendar day of the zone, not of the machine', () => {
    const lateEvening = '2027-10-12T23:30:00Z';

    expect(de.date(lateEvening, BERLIN)).toBe('13.10.2027');
    expect(de.date(lateEvening, 'America/New_York')).toBe('12.10.2027');
  });

  it('writes long dates and date-times in the language of the request', () => {
    expect(de.longDate('2027-10-12T10:00:00+02:00', BERLIN)).toBe('Dienstag, 12. Oktober 2027');
    expect(de.dateTime('2027-10-12T10:00:00+02:00', BERLIN)).toBe('12.10.2027, 10:00');
    expect(createZonedFormat('en').date('2027-10-12T10:00:00+02:00', BERLIN)).toBe('Oct 12, 2027');
  });

  it('formats a calendar day of a location without any zone', () => {
    expect(de.calendarDate('2027-10-12')).toBe('Dienstag, 12. Oktober 2027');
  });
});

describe('values that cannot be shown', () => {
  it.each([
    ['text without an offset (a wall clock, not a moment)', '2027-06-01T10:00'],
    ['a date alone', '2027-06-01'],
    ['text that is not a date', 'tomorrow'],
    ['an empty string', ''],
  ])('answers the missing value for %s', (_name, text) => {
    expect(de.time(text, BERLIN)).toBe(MISSING_VALUE);
    expect(de.date(text, BERLIN)).toBe(MISSING_VALUE);
    expect(de.zoneName(text, BERLIN)).toBe(MISSING_VALUE);
  });

  it('answers the missing value for a zone that does not exist', () => {
    expect(de.time('2027-06-01T10:00:00Z', 'Mars/Base')).toBe(MISSING_VALUE);
    expect(de.zoneName('2027-06-01T10:00:00Z', 'Mars/Base')).toBe(MISSING_VALUE);
  });

  it('does not show a range of which one end is missing', () => {
    expect(de.timeRange('2027-06-01T09:45:00+02:00', 'soon', BERLIN)).toBe(MISSING_VALUE);
  });

  it('refuses an impossible calendar day instead of showing another one', () => {
    expect(de.calendarDate('2027-02-30')).toBe(MISSING_VALUE);
    expect(de.calendarDate('2027-2-3')).toBe(MISSING_VALUE);
  });
});
