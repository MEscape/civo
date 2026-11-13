import { describe, expect, it } from 'vitest';

import {
  errorsUnder,
  messagesByPath,
  sectionOfPath,
  sectionsOfFailure,
  sectionsOfPaths,
} from '@modules/booking/presentation/forms/field-errors';
import { hoursAndMinutes } from '@modules/booking/presentation/forms/week/totals';
import { firstStepWith } from '@modules/booking/presentation/forms/wizard-steps';

describe('the errors of a form, by path', () => {
  it('reads the messages out of react-hook-form’s nested object, leaving the element and the rule behind', () => {
    const errors = {
      name: { type: 'custom', message: 'name-code', ref: {} },
      openingHours: {
        weekly: [{ intervals: [{ end: { message: 'range-code', type: 'custom' } }] }],
        exceptions: [undefined, { from: { message: 'date-code' } }],
      },
    };

    expect(messagesByPath(errors)).toEqual({
      name: 'name-code',
      'openingHours.weekly.0.intervals.0.end': 'range-code',
      'openingHours.exceptions.1.from': 'date-code',
    });
    expect(messagesByPath(undefined)).toEqual({});
  });

  it('takes the part of the path under a day or an exception', () => {
    const errors = { '0.intervals.1.end': 'a', '0.breaks.0.start': 'b', '10.from': 'c' };

    expect(errorsUnder(errors, 0)).toEqual({ 'intervals.1.end': 'a', 'breaks.0.start': 'b' });
    expect(errorsUnder(errors, 10)).toEqual({ from: 'c' });
    expect(errorsUnder(errors, 1)).toEqual({});
  });

  it('says which part of a location a field is in', () => {
    expect(sectionOfPath('name')).toBe('basics');
    expect(sectionOfPath('timeZone')).toBe('basics');
    expect(sectionOfPath('openingHours.weekly.2.breaks.0.start')).toBe('hours');
    expect(sectionOfPath('openingHours.exceptions.0.from')).toBe('exceptions');
  });

  it('takes a wizard to the first step in order that has an error, never the review', () => {
    const failure = sectionsOfFailure({
      fieldErrors: { 'openingHours.exceptions.0.from': ['x'], 'openingHours.weekly.0': ['y'] },
    });

    expect([...failure].sort()).toEqual(['exceptions', 'hours']);
    expect(firstStepWith(failure)).toBe('hours');
    expect(firstStepWith(sectionsOfPaths(['name']))).toBe('basics');
    expect(firstStepWith(new Set(['review']))).toBeUndefined();
    expect(sectionsOfFailure({}).size).toBe(0);
  });
});

describe('hours and minutes', () => {
  it.each([
    [0, 0, 0],
    [59, 0, 59],
    [60, 1, 0],
    [44 * 60 + 5, 44, 5],
  ])('splits %i minutes into %i h %i min', (total, hours, minutes) => {
    expect(hoursAndMinutes(total)).toEqual({ hours, minutes });
  });
});
