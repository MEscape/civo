import { createSlotRules } from '@modules/booking/domain/scheduling/slot-rules';
import type { SlotRules, SlotRulesInput } from '@modules/booking/domain/scheduling/slot-rules';
import type { Instant } from '@modules/booking/domain/time/instant';
import { parseLocalDate } from '@modules/booking/domain/time/local-date';
import type { LocalDate } from '@modules/booking/domain/time/local-date';
import { firstInstantReading } from '@modules/booking/domain/time/local-time-resolution';
import { createInterval } from '@modules/booking/domain/time/time-interval';
import type { TimeInterval } from '@modules/booking/domain/time/time-interval';
import { parseTimeOfDay } from '@modules/booking/domain/time/time-of-day';
import { parseTimeZone, wallClockOf } from '@modules/booking/domain/time/time-zone';
import type { TimeZone } from '@modules/booking/domain/time/time-zone';

import type { AppError } from '@lib/errors';
import type { AppResult } from '@lib/result';

/** Unwraps what a test knows to be valid; a bad fixture should fail loudly, not quietly. */
function required<T>(value: T | null, what: string): T {
  if (value === null) {
    throw new Error(`Invalid test fixture: ${what}`);
  }
  return value;
}

export function zone(name: string): TimeZone {
  return required(parseTimeZone(name), name);
}

export const BERLIN = zone('Europe/Berlin');
export const NEW_YORK = zone('America/New_York');

export function day(text: string): LocalDate {
  return required(parseLocalDate(text), text);
}

/** The first instant at which the wall clock of the zone reads `time` on `date` or later. */
export function at(date: string, time: string, inZone: TimeZone = BERLIN): Instant {
  return firstInstantReading(day(date), required(parseTimeOfDay(time), time), inZone);
}

export function span(start: Instant, end: Instant): TimeInterval {
  return required(createInterval(start, end), 'empty or reversed interval');
}

/** `[from, to)` on one local day. */
export function between(
  date: string,
  from: string,
  to: string,
  inZone: TimeZone = BERLIN,
): TimeInterval {
  return span(at(date, from, inZone), at(date, to, inZone));
}

/** An instant as the wall clock of a zone shows it, for readable assertions: `2027-01-11 09:30`. */
export function clock(instant: Instant, inZone: TimeZone = BERLIN): string {
  const { date, minuteOfDay } = wallClockOf(instant, inZone);
  const pad = (value: number) => String(value).padStart(2, '0');
  const time = `${pad(Math.floor(minuteOfDay / 60))}:${pad(minuteOfDay % 60)}`;
  return `${date.year}-${pad(date.month)}-${pad(date.day)} ${time}`;
}

export function unwrap<T, E extends AppError>(result: AppResult<T, E>): T {
  if (result.isErr()) {
    throw new Error(`Expected a valid result, got: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

const DEFAULT_RULES: SlotRulesInput = {
  durationMinutes: 30,
  preparationMinutes: 0,
  cleanupMinutes: 0,
  stepMinutes: 30,
};

export function rulesOf(overrides: Partial<SlotRulesInput> = {}): SlotRules {
  return unwrap(createSlotRules({ ...DEFAULT_RULES, ...overrides }));
}
