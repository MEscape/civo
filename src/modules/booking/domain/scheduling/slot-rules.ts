import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { BOOKING_VALIDATION_CODES as CODES, createBookingErrorBag } from '../errors/booking-errors';
import { addMinutes, subtractMinutes } from '../time/instant';
import { parseMinutes } from '../time/minutes';

import type { Instant } from '../time/instant';
import type { Minutes } from '../time/minutes';
import type { TimeInterval } from '../time/time-interval';

/** The limits the database also enforces (`BookableService_timing_rule`, `_buffers_rule`). */
export const SLOT_RULE_LIMITS = {
  durationMin: 5,
  durationMax: 1440,
  bufferMax: 240,
  stepMin: 5,
  stepMax: 240,
} as const;

/**
 * How long an appointment lasts and what surrounds it. Three spans are never to be confused:
 *  - the **appointment** `[start, start + duration)`, which the visitor sees and which must lie
 *    inside the opening hours;
 *  - the **occupied span**, the appointment plus preparation before and clean-up after, which is
 *    what a resource must be free and working for, and what a booking blocks;
 *  - the **step**, the spacing of offered start times, independent of the duration.
 */
export interface SlotRules {
  readonly durationMinutes: Minutes;
  readonly preparationMinutes: Minutes;
  readonly cleanupMinutes: Minutes;
  readonly stepMinutes: Minutes;
}

export interface SlotRulesInput {
  readonly durationMinutes: number;
  readonly preparationMinutes: number;
  readonly cleanupMinutes: number;
  readonly stepMinutes: number;
}

function parseWithin(value: number, min: number, max: number): Minutes | null {
  const minutes = parseMinutes(value);
  return minutes !== null && minutes >= min && minutes <= max ? minutes : null;
}

/** Validates the numbers; every problem is reported at once, on the field that has it. */
export function createSlotRules(input: SlotRulesInput): AppResult<SlotRules, ValidationAppError> {
  const limits = SLOT_RULE_LIMITS;
  const durationMinutes = parseWithin(
    input.durationMinutes,
    limits.durationMin,
    limits.durationMax,
  );
  const preparationMinutes = parseWithin(input.preparationMinutes, 0, limits.bufferMax);
  const cleanupMinutes = parseWithin(input.cleanupMinutes, 0, limits.bufferMax);
  const stepMinutes = parseWithin(input.stepMinutes, limits.stepMin, limits.stepMax);

  const bag = createBookingErrorBag();
  bag.expect(durationMinutes !== null, 'durationMinutes', CODES.durationInvalid);
  bag.expect(preparationMinutes !== null, 'preparationMinutes', CODES.bufferInvalid);
  bag.expect(cleanupMinutes !== null, 'cleanupMinutes', CODES.bufferInvalid);
  bag.expect(stepMinutes !== null, 'stepMinutes', CODES.slotIntervalInvalid);

  if (
    durationMinutes === null ||
    preparationMinutes === null ||
    cleanupMinutes === null ||
    stepMinutes === null
  ) {
    return err(bag.toError());
  }
  return ok({ durationMinutes, preparationMinutes, cleanupMinutes, stepMinutes });
}

/** The appointment that starts at `start`. */
export function appointmentAt(start: Instant, rules: SlotRules): TimeInterval {
  return { start, end: addMinutes(start, rules.durationMinutes) };
}

/** What the appointment blocks: itself plus its preparation and clean-up. */
export function occupiedSpanOf(appointment: TimeInterval, rules: SlotRules): TimeInterval {
  return {
    start: subtractMinutes(appointment.start, rules.preparationMinutes),
    end: addMinutes(appointment.end, rules.cleanupMinutes),
  };
}
