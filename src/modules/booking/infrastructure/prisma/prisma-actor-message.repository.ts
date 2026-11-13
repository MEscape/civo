import type { ActorId } from '@modules/auth';

import { createPersistenceFailures } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { combine, fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { BOOKING_ERROR_CODES as CODES } from '../../domain/errors/booking-errors';

import { MESSAGE_SELECT, toActorMessage } from './actor-message-record-mapper';
import { toRecordInstant } from './instant-record-mapper';
import { messagesOf } from './tenant-ownership';

import type {
  ActorMessagePage,
  ActorMessageRepository,
} from '../../domain/ports/actor-message.repository';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';

const failures = createPersistenceFailures({
  module: 'booking.persistence',
  code: CODES.persistenceFailed,
  subject: 'Actor message',
});

/** One member's inbox: the website and the member are part of every statement. */
export class PrismaActorMessageRepository implements ActorMessageRepository {
  list(
    scope: BookingScope,
    actorId: ActorId,
    { limit, offset }: { readonly limit: number; readonly offset: number },
  ): AppResultAsync<ActorMessagePage, InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      const own = () => messagesOf(scope).where({ recipientActorId: actorId });
      const records = await own()
        .select(...MESSAGE_SELECT)
        .orderBy([(message) => message.createdAt.desc(), (message) => message.id.desc()])
        .limit(limit)
        .offset(offset)
        .all();
      const { total } = await own().aggregate((aggregate) => ({ total: aggregate.count() }));
      const { unread } = await own()
        .where((message) => message.readAt.isNull())
        .aggregate((aggregate) => ({ unread: aggregate.count() }));
      return { records, total, unread };
    }, failures.infraOnly('listMessages')).andThen(({ records, total, unread }) =>
      combine(records.map(toActorMessage)).map((items) => ({ items, total, unread })),
    );
  }

  countUnread(
    scope: BookingScope,
    actorId: ActorId,
  ): AppResultAsync<number, InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      const { unread } = await messagesOf(scope)
        .where({ recipientActorId: actorId })
        .where((message) => message.readAt.isNull())
        .aggregate((aggregate) => ({ unread: aggregate.count() }));
      return unread;
    }, failures.infraOnly('countUnread'));
  }

  markRead(
    scope: BookingScope,
    actorId: ActorId,
    { messageId, now }: { readonly messageId: string | null; readonly now: Instant },
  ): AppResultAsync<number, InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      let unread = messagesOf(scope)
        .where({ recipientActorId: actorId })
        .where((message) => message.readAt.isNull());
      if (messageId !== null) {
        unread = unread.where({ id: messageId });
      }
      return unread.updateAndCount({ readAt: toRecordInstant(now) });
    }, failures.infraOnly('markRead'));
  }
}

/** The one instance the composition root wires (the adapter holds no state). */
export const prismaActorMessageRepository = new PrismaActorMessageRepository();
