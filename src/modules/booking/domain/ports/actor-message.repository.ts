import type { ActorId } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { BookingScope } from './booking.repository';
import type { ActorMessage } from '../models/actor-message';
import type { Instant } from '../time/instant';

export interface ActorMessagePage {
  /** Newest first. */
  readonly items: readonly ActorMessage[];
  readonly total: number;
  readonly unread: number;
}

/**
 * The inbox of one member of one website. Messages are written by the booking writes themselves
 * (in their transaction, `BookingChange.notices`), so this port only reads them and marks them read.
 * Every call names the member, and a member of another website finds nothing.
 */
export interface ActorMessageRepository {
  list(
    scope: BookingScope,
    actorId: ActorId,
    page: { readonly limit: number; readonly offset: number },
  ): AppResultAsync<ActorMessagePage, InfrastructureAppError>;

  countUnread(
    scope: BookingScope,
    actorId: ActorId,
  ): AppResultAsync<number, InfrastructureAppError>;

  /** Marks one message, or every unread one when `messageId` is `null`; how many changed. Repeating it changes nothing. */
  markRead(
    scope: BookingScope,
    actorId: ActorId,
    change: { readonly messageId: string | null; readonly now: Instant },
  ): AppResultAsync<number, InfrastructureAppError>;
}
