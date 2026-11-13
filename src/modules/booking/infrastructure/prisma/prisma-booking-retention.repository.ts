import { createPersistenceFailures, db } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { BOOKING_ERROR_CODES as CODES } from '../../domain/errors/booking-errors';

import { toRetentionOutcome } from './booking-retention-record-mapper';
import { toRecordInstant } from './instant-record-mapper';

import type {
  BookingRetentionRepository,
  RetentionOutcome,
} from '../../domain/ports/booking-retention.repository';
import type { Instant } from '../../domain/time/instant';

const failures = createPersistenceFailures({
  module: 'booking.persistence',
  code: CODES.persistenceFailed,
  subject: 'Booking retention',
});

/** The booking module's retention on its tables: the bookings that ended, and the messages. */
export class PrismaBookingRetentionRepository implements BookingRetentionRepository {
  /** @owner-scope platform Retention is a job of the platform: it removes what is past its time in every website. */
  deleteEndedBefore(cutoff: Instant): AppResultAsync<RetentionOutcome, InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      const stamp = toRecordInstant(cutoff);
      // Units and the messages about a booking go with it (cascade); what is left are the messages about a calendar.
      const bookings = await db.orm.public.Booking.where((booking) =>
        booking.end.lt(stamp),
      ).deleteAndCount();
      const messages = await db.orm.public.ActorMessage.where((message) =>
        message.createdAt.lt(stamp),
      ).deleteAndCount();
      return toRetentionOutcome(bookings, messages);
    }, failures.infraOnly('deleteEndedBefore'));
  }
}

/** The one instance the retention job is wired with (the adapter holds no state). */
export const prismaBookingRetentionRepository = new PrismaBookingRetentionRepository();
