import type { RetentionOutcome } from '../../domain/ports/booking-retention.repository';

/** What a retention run answers, from the two counts the database gave back. */
export function toRetentionOutcome(bookings: number, messages: number): RetentionOutcome {
  return { bookings, messages };
}
