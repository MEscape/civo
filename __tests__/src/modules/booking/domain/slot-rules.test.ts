import { describe, expect, it } from 'vitest';

import { BOOKING_VALIDATION_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';
import {
  SLOT_RULE_LIMITS,
  appointmentAt,
  createSlotRules,
  occupiedSpanOf,
} from '@modules/booking/domain/scheduling/slot-rules';
import {
  MAX_HORIZON_DAYS,
  createStartWindow,
  isStartAllowed,
} from '@modules/booking/domain/scheduling/start-window';
import { intervalLengthMinutes } from '@modules/booking/domain/time/time-interval';

import { BERLIN, at, clock, rulesOf, unwrap } from '../support/time-fixtures';

const VALID = { durationMinutes: 30, preparationMinutes: 0, cleanupMinutes: 0, stepMinutes: 15 };

function fieldErrorsOf(overrides: Partial<typeof VALID>): Record<string, string[]> {
  const result = createSlotRules({ ...VALID, ...overrides });
  return result.isErr() ? result.error.fieldErrors : {};
}

describe('slot rules', () => {
  it('accepts valid durations, buffers and steps, including the limits', () => {
    expect(createSlotRules(VALID).isOk()).toBe(true);
    const limits = SLOT_RULE_LIMITS;
    expect(
      createSlotRules({
        durationMinutes: limits.durationMax,
        preparationMinutes: limits.bufferMax,
        cleanupMinutes: limits.bufferMax,
        stepMinutes: limits.stepMax,
      }).isOk(),
    ).toBe(true);
    expect(
      createSlotRules({
        durationMinutes: limits.durationMin,
        preparationMinutes: 0,
        cleanupMinutes: 0,
        stepMinutes: limits.stepMin,
      }).isOk(),
    ).toBe(true);
  });

  it('refuses invalid durations: zero, too short, too long, fractional, not a number', () => {
    for (const durationMinutes of [0, 4, 1441, 7.5, -30, Number.NaN]) {
      expect(fieldErrorsOf({ durationMinutes })).toEqual({
        durationMinutes: [CODES.durationInvalid],
      });
    }
  });

  it('refuses invalid buffers on the buffer that is wrong', () => {
    expect(fieldErrorsOf({ preparationMinutes: -1 })).toEqual({
      preparationMinutes: [CODES.bufferInvalid],
    });
    expect(fieldErrorsOf({ cleanupMinutes: 241 })).toEqual({
      cleanupMinutes: [CODES.bufferInvalid],
    });
  });

  it('refuses invalid steps', () => {
    for (const stepMinutes of [0, 4, 241, 2.5]) {
      expect(fieldErrorsOf({ stepMinutes })).toEqual({ stepMinutes: [CODES.slotIntervalInvalid] });
    }
  });

  it('reports every wrong field at once', () => {
    expect(fieldErrorsOf({ durationMinutes: 0, preparationMinutes: -5, stepMinutes: 1 })).toEqual({
      durationMinutes: [CODES.durationInvalid],
      preparationMinutes: [CODES.bufferInvalid],
      stepMinutes: [CODES.slotIntervalInvalid],
    });
  });

  it('keeps the appointment, its occupied span and the step apart', () => {
    const rules = rulesOf({ durationMinutes: 45, preparationMinutes: 10, cleanupMinutes: 15 });
    const start = at('2027-01-11', '10:00');

    const appointment = appointmentAt(start, rules);
    const occupied = occupiedSpanOf(appointment, rules);

    expect([clock(appointment.start), clock(appointment.end)]).toEqual([
      '2027-01-11 10:00',
      '2027-01-11 10:45',
    ]);
    expect([clock(occupied.start), clock(occupied.end)]).toEqual([
      '2027-01-11 09:50',
      '2027-01-11 11:00',
    ]);
    expect(intervalLengthMinutes(occupied)).toBe(70);
  });

  it('measures the appointment in elapsed time on a daylight-saving day', () => {
    const rules = rulesOf({ durationMinutes: 60 });
    // 01:30 + 60 minutes crosses the spring-forward gap: it ends at 03:30 on the wall clock.
    const appointment = appointmentAt(at('2027-03-28', '01:30'), rules);
    expect(clock(appointment.end)).toBe('2027-03-28 03:30');
    expect(intervalLengthMinutes(appointment)).toBe(60);
  });
});

describe('start window: notice and horizon', () => {
  function windowAt(now: string, overrides: { noticeMinutes?: number; horizonDays?: number } = {}) {
    return unwrap(
      createStartWindow({
        now: at(now.slice(0, 10), now.slice(11)),
        zone: BERLIN,
        noticeMinutes: 0,
        horizonDays: 7,
        ...overrides,
      }),
    );
  }

  it('opens at now plus the notice, to the minute', () => {
    const window = windowAt('2027-01-11 08:30', { noticeMinutes: 60 });
    expect(clock(window.from)).toBe('2027-01-11 09:30');
    expect(isStartAllowed(window, at('2027-01-11', '09:29'))).toBe(false);
    expect(isStartAllowed(window, at('2027-01-11', '09:30'))).toBe(true);
  });

  it('allows a start at the very moment of the question when there is no notice', () => {
    const window = windowAt('2027-01-11 08:30');
    expect(isStartAllowed(window, at('2027-01-11', '08:30'))).toBe(true);
    expect(isStartAllowed(window, at('2027-01-11', '08:29'))).toBe(false);
  });

  it('counts the horizon in local calendar days: the last day is open to its end', () => {
    const window = windowAt('2027-01-11 23:50', { horizonDays: 1 });
    expect(isStartAllowed(window, at('2027-01-12', '23:59'))).toBe(true);
    expect(isStartAllowed(window, at('2027-01-13', '00:00'))).toBe(false);
  });

  it('counts the horizon by calendar day across the 23-hour spring day', () => {
    const window = windowAt('2027-03-27 12:00', { horizonDays: 1 });
    // The day after tomorrow starts at 00:00 local, 23 hours after the start of tomorrow.
    expect(isStartAllowed(window, at('2027-03-28', '23:30'))).toBe(true);
    expect(isStartAllowed(window, at('2027-03-29', '00:00'))).toBe(false);
  });

  it('is empty, not an error, when the notice outlasts the horizon', () => {
    const window = windowAt('2027-01-11 08:00', { noticeMinutes: 10 * 24 * 60, horizonDays: 3 });
    expect(window.until <= window.from).toBe(true);
    expect(isStartAllowed(window, at('2027-01-12', '10:00'))).toBe(false);
    expect(isStartAllowed(window, at('2027-01-22', '10:00'))).toBe(false);
  });

  it('refuses an invalid notice or horizon, field by field', () => {
    const now = at('2027-01-11', '08:00');
    const errorsOf = (noticeMinutes: number, horizonDays: number) => {
      const result = createStartWindow({ now, zone: BERLIN, noticeMinutes, horizonDays });
      return result.isErr() ? result.error.fieldErrors : {};
    };
    expect(errorsOf(-1, 7)).toEqual({ noticeMinutes: [CODES.noticeInvalid] });
    expect(errorsOf(0.5, 7)).toEqual({ noticeMinutes: [CODES.noticeInvalid] });
    expect(errorsOf(0, 0)).toEqual({ horizonDays: [CODES.horizonInvalid] });
    expect(errorsOf(0, MAX_HORIZON_DAYS + 1)).toEqual({ horizonDays: [CODES.horizonInvalid] });
    expect(errorsOf(0, 1.5)).toEqual({ horizonDays: [CODES.horizonInvalid] });
    expect(errorsOf(-1, 0)).toEqual({
      noticeMinutes: [CODES.noticeInvalid],
      horizonDays: [CODES.horizonInvalid],
    });
    expect(
      createStartWindow({ now, zone: BERLIN, noticeMinutes: 0, horizonDays: 730 }).isOk(),
    ).toBe(true);
  });
});
