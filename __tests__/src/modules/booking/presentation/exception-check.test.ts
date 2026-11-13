import { describe, expect, it } from 'vitest';

import type { ExceptionInputDto } from '@modules/booking/client';
import { exceptionProblems } from '@modules/booking/presentation/forms/exception-check';
import { BLANK_EXCEPTION } from '@modules/booking/presentation/forms/exceptions';

const CLOSED_DAY: ExceptionInputDto = { kind: 'closed', from: '2027-05-05', to: '2027-05-05' };
const OVERRIDE: ExceptionInputDto = {
  kind: 'override',
  from: '2027-12-24',
  to: '2027-12-27',
  day: { intervals: [{ start: '08:00', end: '12:00' }], breaks: [] },
};

describe('exceptionProblems', () => {
  it('has nothing to say about an exception the rules accept', () => {
    expect(exceptionProblems([], [CLOSED_DAY], 0)).toEqual({});
  });

  it('names the fields of a blank exception, as the server would', () => {
    const problems = exceptionProblems([], [BLANK_EXCEPTION], 0);
    expect(Object.keys(problems)).toContain('from');
  });

  it('refuses a period that ends before it starts, on the exception that is being made', () => {
    const problems = exceptionProblems(
      [CLOSED_DAY],
      [CLOSED_DAY, { ...CLOSED_DAY, to: '2027-05-01' }],
      1,
    );
    expect(Object.keys(problems).length).toBeGreaterThan(0);
  });

  it('puts an overlap that the rules name on the older exception on the new one', () => {
    const later = { ...OVERRIDE, from: '2027-12-26', to: '2027-12-30' };
    // The rules flag the later of two overlapping overrides; the new exception is the earlier one.
    const earlier = { ...OVERRIDE, from: '2027-12-20', to: '2027-12-28' };
    const problems = exceptionProblems([later], [later, earlier], 1);
    expect(problems['from']).toBeDefined();
  });

  it('does not blame an exception for a problem that was already in the list', () => {
    const broken = { ...CLOSED_DAY, to: '2027-05-01' };
    expect(exceptionProblems([broken], [broken, OVERRIDE], 1)).toEqual({});
  });

  it('asks for hours when an exception is not a closure', () => {
    const { day: _day, ...withoutHours } = OVERRIDE;
    const problems = exceptionProblems([], [withoutHours], 0);
    expect(Object.keys(problems).length).toBeGreaterThan(0);
  });
});
