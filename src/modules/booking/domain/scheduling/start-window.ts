import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { BOOKING_VALIDATION_CODES as CODES, createBookingErrorBag } from '../errors/booking-errors';
import { addMinutes } from '../time/instant';
import { addLocalDays } from '../time/local-date';
import { startOfLocalDay } from '../time/local-time-resolution';
import { parseMinutes } from '../time/minutes';
import { localDateOf } from '../time/time-zone';

import type { Instant } from '../time/instant';
import type { TimeZone } from '../time/time-zone';

/** The longest horizon a service may have (`BookableService_window_rule`). */
export const MAX_HORIZON_DAYS = 730;

/**
 * The time in which a booking may START: not before `from`, before `until`. It is empty when
 * `until <= from` (a notice longer than the horizon), which is a valid answer, not an error: nothing
 * is bookable.
 */
export interface StartWindow {
  readonly from: Instant;
  readonly until: Instant;
}

export interface StartWindowInput {
  /** The moment the question is asked, handed in so the answer is repeatable. */
  readonly now: Instant;
  /** The zone of the location: the horizon counts its calendar days. */
  readonly zone: TimeZone;
  readonly noticeMinutes: number;
  readonly horizonDays: number;
}

/**
 * Notice and horizon as one window. A visitor may start `noticeMinutes` after `now` at the
 * earliest. The horizon counts local calendar days of the location: with a horizon of 1 the whole of
 * today and the whole of tomorrow are open, whatever the clock says, and the day after tomorrow
 * is not, which is also right on a 23- or 25-hour day.
 */
export function createStartWindow(
  input: StartWindowInput,
): AppResult<StartWindow, ValidationAppError> {
  const noticeMinutes = parseMinutes(input.noticeMinutes);
  const isHorizonValid =
    Number.isInteger(input.horizonDays) &&
    input.horizonDays >= 1 &&
    input.horizonDays <= MAX_HORIZON_DAYS;

  const bag = createBookingErrorBag();
  bag.expect(noticeMinutes !== null, 'noticeMinutes', CODES.noticeInvalid);
  bag.expect(isHorizonValid, 'horizonDays', CODES.horizonInvalid);
  if (noticeMinutes === null || !isHorizonValid) {
    return err(bag.toError());
  }

  const today = localDateOf(input.now, input.zone);
  return ok({
    from: addMinutes(input.now, noticeMinutes),
    until: startOfLocalDay(addLocalDays(today, input.horizonDays + 1), input.zone),
  });
}

/** Whether a booking may start at `start`. */
export function isStartAllowed(window: StartWindow, start: Instant): boolean {
  return start >= window.from && start < window.until;
}
