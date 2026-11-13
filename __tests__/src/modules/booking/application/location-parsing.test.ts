import { describe, expect, it } from 'vitest';

import type { LocationInput } from '@modules/booking/application/contracts/location-inputs';
import { parseLocationInput } from '@modules/booking/application/services/parse-location-input';
import { BOOKING_VALIDATION_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';

import { CLOSED, locationInput, officeWeek } from '../support/location-inputs';

/** The field errors of an input that is refused, by path. */
function refusal(input: LocationInput): Record<string, string[]> {
  const result = parseLocationInput(input);
  if (result.isOk()) {
    throw new Error('expected the input to be refused');
  }
  const { error } = result;
  return error.kind === 'validation' ? error.fieldErrors : {};
}

function withWeek(monday: LocationInput['openingHours']['weekly'][number]): LocationInput {
  return locationInput({
    openingHours: { weekly: officeWeek({ 0: monday }), exceptions: [] },
  });
}

describe('parseLocationInput', () => {
  it('reads a location into the rules own types', () => {
    const parsed = parseLocationInput(locationInput({ name: '  Bürgerbüro Mitte  ', address: '' }));

    expect(parsed.isOk()).toBe(true);
    if (parsed.isErr()) {
      return;
    }
    expect(parsed.value.name).toBe('Bürgerbüro Mitte');
    expect(parsed.value.address).toBeNull();
    expect(parsed.value.zone).toBe('Europe/Berlin');
    expect(parsed.value.openingHours.weekly[1].ranges).toEqual([
      { startMinute: 480, endMinute: 1080 },
    ]);
    expect(parsed.value.openingHours.weekly[1].breaks).toEqual([
      { startMinute: 720, endMinute: 780 },
    ]);
    expect(parsed.value.openingHours.weekly[6].ranges).toEqual([]);
  });

  it('puts ranges in order, so two requests that mean the same hours are equal', () => {
    const shuffled = parseLocationInput(
      withWeek({
        intervals: [
          { start: '14:00', end: '18:00' },
          { start: '08:00', end: '12:00' },
        ],
        breaks: [],
      }),
    );
    const ordered = parseLocationInput(
      withWeek({
        intervals: [
          { start: '08:00', end: '12:00' },
          { start: '14:00', end: '18:00' },
        ],
        breaks: [],
      }),
    );

    expect(shuffled.isOk() && ordered.isOk() && shuffled.value.openingHours.weekly[1]).toEqual(
      ordered.isOk() ? ordered.value.openingHours.weekly[1] : null,
    );
  });

  it('accepts a day that runs to midnight', () => {
    expect(
      parseLocationInput(
        withWeek({ intervals: [{ start: '08:00', end: '24:00' }], breaks: [] }),
      ).isOk(),
    ).toBe(true);
  });

  it.each([
    ['an empty name', { name: '   ' }, 'name', CODES.nameInvalid],
    ['a name that is too long', { name: 'x'.repeat(121) }, 'name', CODES.nameInvalid],
    ['an address that is too long', { address: 'x'.repeat(301) }, 'address', CODES.addressInvalid],
    [
      'a time zone that does not exist',
      { timeZone: 'Mars/Base' },
      'timeZone',
      CODES.timeZoneInvalid,
    ],
    ['a time zone that is not a zone name', { timeZone: '' }, 'timeZone', CODES.timeZoneInvalid],
  ])('refuses %s, at the field', (_name, overrides, path, code) => {
    expect(refusal(locationInput(overrides))[path]).toEqual([code]);
  });

  it('refuses a week that is not seven days', () => {
    const input = locationInput({
      openingHours: { weekly: officeWeek().slice(0, 6), exceptions: [] },
    });

    expect(refusal(input)['openingHours.weekly']).toEqual([CODES.weekInvalid]);
  });

  it.each([
    ['an end before the start', { start: '18:00', end: '08:00' }],
    ['an empty range', { start: '08:00', end: '08:00' }],
    ['an end that is not a time', { start: '08:00', end: '25:00' }],
    ['text that is not a time', { start: 'early', end: '12:00' }],
    ['24:00 as a start', { start: '24:00', end: '24:00' }],
  ])('refuses %s, at the row', (_name, range) => {
    const errors = refusal(withWeek({ intervals: [range], breaks: [] }));

    expect(Object.keys(errors)).toHaveLength(1);
    expect(Object.keys(errors)[0]).toMatch(/^openingHours\.weekly\.0\.intervals\.0\.(start|end)$/);
    expect(Object.values(errors)[0]).toEqual([CODES.timeRangeInvalid]);
  });

  it('refuses ranges that overlap, naming the later one, however they are ordered', () => {
    const errors = refusal(
      withWeek({
        intervals: [
          { start: '09:00', end: '10:00' },
          { start: '08:00', end: '18:00' },
          { start: '11:00', end: '12:00' },
        ],
        breaks: [],
      }),
    );

    expect(errors).toEqual({
      'openingHours.weekly.0.intervals.0.start': [CODES.timeRangesOverlap],
      'openingHours.weekly.0.intervals.2.start': [CODES.timeRangesOverlap],
    });
  });

  it('lets ranges touch', () => {
    expect(
      parseLocationInput(
        withWeek({
          intervals: [
            { start: '08:00', end: '12:00' },
            { start: '12:00', end: '18:00' },
          ],
          breaks: [],
        }),
      ).isOk(),
    ).toBe(true);
  });

  it('refuses a break outside the open hours, and breaks that overlap', () => {
    const outside = refusal(
      withWeek({
        intervals: [{ start: '08:00', end: '12:00' }],
        breaks: [{ start: '11:00', end: '13:00' }],
      }),
    );
    const overlapping = refusal(
      withWeek({
        intervals: [{ start: '08:00', end: '18:00' }],
        breaks: [
          { start: '12:00', end: '13:00' },
          { start: '12:30', end: '13:30' },
        ],
      }),
    );

    expect(outside).toEqual({ 'openingHours.weekly.0.breaks.0.start': [CODES.breakOutsideHours] });
    expect(overlapping).toEqual({
      'openingHours.weekly.0.breaks.1.start': [CODES.timeRangesOverlap],
    });
  });

  it('refuses a break on a day that is closed', () => {
    const errors = refusal(withWeek({ intervals: [], breaks: [{ start: '12:00', end: '13:00' }] }));

    expect(errors).toEqual({ 'openingHours.weekly.0.breaks.0.start': [CODES.breakOutsideHours] });
  });

  it('reports every problem at once, not one per round trip', () => {
    const errors = refusal({
      ...withWeek({ intervals: [{ start: '18:00', end: '08:00' }], breaks: [] }),
      name: '',
      timeZone: 'nowhere',
    });

    expect(Object.keys(errors).sort()).toEqual([
      'name',
      'openingHours.weekly.0.intervals.0.end',
      'timeZone',
    ]);
  });

  describe('exceptions', () => {
    const exceptionsOf = (
      ...exceptions: Array<LocationInput['openingHours']['exceptions'][number]>
    ) => locationInput({ openingHours: { weekly: officeWeek(), exceptions } });

    it('reads closures, other hours and extra hours, earliest first', () => {
      const parsed = parseLocationInput(
        exceptionsOf(
          {
            kind: 'override',
            from: '2027-12-24',
            to: '2027-12-24',
            day: { intervals: [{ start: '08:00', end: '12:00' }], breaks: [] },
          },
          { kind: 'closed', from: '2027-01-01', to: '2027-01-01' },
          {
            kind: 'additional',
            from: '2027-05-01',
            to: '2027-05-02',
            day: { intervals: [{ start: '10:00', end: '14:00' }], breaks: [] },
          },
        ),
      );

      expect(parsed.isOk()).toBe(true);
      if (parsed.isErr()) {
        return;
      }
      const { exceptions } = parsed.value.openingHours;
      expect(exceptions.map(({ kind, from }) => `${kind}@${from.month}-${from.day}`)).toEqual([
        'closed@1-1',
        'additional@5-1',
        'override@12-24',
      ]);
      expect(exceptions[0]?.day).toEqual({ ranges: [], breaks: [] });
    });

    it.each([
      [
        'a date that does not exist',
        { kind: 'closed', from: '2027-02-30', to: '2027-03-01' },
        'from',
      ],
      ['an end before the start', { kind: 'closed', from: '2027-03-02', to: '2027-03-01' }, 'to'],
      ['a run of more than a year', { kind: 'closed', from: '2027-01-01', to: '2028-01-02' }, 'to'],
      ['a kind that is not one', { kind: 'holiday', from: '2027-01-01', to: '2027-01-01' }, 'kind'],
    ] as const)('refuses %s', (_name, exception, field) => {
      const errors = refusal(exceptionsOf(exception as never));

      expect(errors).toEqual({ [`openingHours.exceptions.0.${field}`]: [CODES.exceptionInvalid] });
    });

    it('refuses other hours without any hours, which is what a closure is for', () => {
      const errors = refusal(
        exceptionsOf({ kind: 'override', from: '2027-12-24', to: '2027-12-24', day: CLOSED }),
      );

      expect(errors).toEqual({
        'openingHours.exceptions.0.day.intervals': [CODES.exceptionInvalid],
      });
    });

    it('checks the hours of an exception like those of the week', () => {
      const errors = refusal(
        exceptionsOf({
          kind: 'override',
          from: '2027-12-24',
          to: '2027-12-24',
          day: { intervals: [{ start: '12:00', end: '08:00' }], breaks: [] },
        }),
      );

      expect(errors).toEqual({
        'openingHours.exceptions.0.day.intervals.0.end': [CODES.timeRangeInvalid],
      });
    });

    it('refuses two exceptions with other hours that share a day, and names the later one', () => {
      const day = { intervals: [{ start: '08:00', end: '12:00' }], breaks: [] };
      const errors = refusal(
        exceptionsOf(
          { kind: 'override', from: '2027-12-23', to: '2027-12-27', day },
          { kind: 'override', from: '2027-12-27', to: '2027-12-28', day },
        ),
      );

      expect(errors).toEqual({ 'openingHours.exceptions.1.from': [CODES.exceptionsOverlap] });
    });

    it('lets other hours sit beside each other, and beside closures and extra hours', () => {
      const day = { intervals: [{ start: '08:00', end: '12:00' }], breaks: [] };
      const parsed = parseLocationInput(
        exceptionsOf(
          { kind: 'override', from: '2027-12-23', to: '2027-12-24', day },
          { kind: 'override', from: '2027-12-25', to: '2027-12-26', day },
          { kind: 'closed', from: '2027-12-24', to: '2027-12-25' },
          { kind: 'additional', from: '2027-12-24', to: '2027-12-26', day },
        ),
      );

      expect(parsed.isOk()).toBe(true);
    });

    it('refuses more exceptions than one location may have', () => {
      const many = Array.from({ length: 501 }, () => ({
        kind: 'closed' as const,
        from: '2027-01-01',
        to: '2027-01-01',
      }));

      expect(refusal(exceptionsOf(...many))['openingHours.exceptions']).toEqual([CODES.tooMany]);
    });
  });
});
