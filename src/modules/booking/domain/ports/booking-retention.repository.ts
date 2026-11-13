import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { Instant } from '../time/instant';

/** What a retention run removed. */
export interface RetentionOutcome {
  readonly bookings: number;
  readonly messages: number;
}

/**
 * Keeps what the module stores about people to a time limit. It is a job of the platform, not of a
 * website: it works across every website and has no actor.
 */
export interface BookingRetentionRepository {
  /**
   * Deletes the bookings that ended before `cutoff` (their units and messages with them) and the
   * messages older than it. A booking that has not ended, whatever its state, is never touched.
   */
  deleteEndedBefore(cutoff: Instant): AppResultAsync<RetentionOutcome, InfrastructureAppError>;
}
