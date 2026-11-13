import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import { MS_PER_DAY } from '@lib/utils';

import { asInstant } from '../../domain/time/instant';

import { currentInstant } from './clock-instant';

import type { RetentionOutcome } from '../../domain/ports/booking-retention.repository';
import type { BookingRetentionDependencies } from '../booking-dependencies';

/**
 * Deletes the bookings that ended longer ago than the retention, for every website at once, and with
 * them the citizen's name and e-mail they hold, the units, and the messages about them; and the
 * messages about calendars that are as old. Answers how much went, which the job logs.
 *
 * It is the server's own daily housekeeping, with no request and no actor, so it is a service and not
 * a use case: nothing here is authorized or audited per website.
 */
export function pruneBookings({
  retention,
  clock,
  retentionDays,
}: BookingRetentionDependencies): AppResultAsync<RetentionOutcome, InfrastructureAppError> {
  return retention.deleteEndedBefore(asInstant(currentInstant(clock) - retentionDays * MS_PER_DAY));
}
