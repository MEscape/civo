import type { AppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { BOOKING_ERROR_CODES as CODES } from '../../domain/errors/booking-errors';
import { MAX_STALE_RETRIES } from '../booking-limits';

function retryOn<T, E extends AppError>(
  codes: readonly string[],
  attempt: () => AppResultAsync<T, E>,
): AppResultAsync<T, E> {
  const run = (retriesLeft: number): AppResultAsync<T, E> =>
    attempt().orElse((error) =>
      codes.includes(error.code) && retriesLeft > 0 ? run(retriesLeft - 1) : errAsync(error),
    );
  return run(MAX_STALE_RETRIES);
}

/**
 * Runs a change that reads a booking, decides and writes it, and runs the WHOLE thing again when
 * the write finds the booking changed meanwhile (`booking.stale`): the new run reads the booking as
 * it is now, so the second look sees what the winner did (an employee already assigned, a booking
 * already cancelled) and answers with the rule's own error instead of with "try again". Only that
 * code is retried, and only a few times. A change that creates something is never run here, so a
 * retry cannot make a duplicate.
 */
export function retryOnStale<T, E extends AppError>(
  attempt: () => AppResultAsync<T, E>,
): AppResultAsync<T, E> {
  return retryOn([CODES.bookingStale], attempt);
}

/**
 * For a change that PICKS the resources of a time: a hold, a new booking, a move. When two requests
 * read the same free schedule they pick the same employee and the database lets one of them in
 * (`booking.resource_taken`); the loser has lost the employee, not necessarily the time. Running the
 * whole decision again reads the schedule with the winner in it, so it picks the other free employee
 * or, when none is left, answers `booking.slot_unavailable`. The failed write rolled back, so a rerun
 * cannot leave a second booking behind; the stale case is handled as in `retryOnStale`.
 */
export function retryOnLostRace<T, E extends AppError>(
  attempt: () => AppResultAsync<T, E>,
): AppResultAsync<T, E> {
  return retryOn([CODES.bookingStale, CODES.resourceTaken], attempt);
}
