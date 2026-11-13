import { randomUUID } from 'node:crypto';

import { toJsonValue } from '@lib/db';

import { toMessageParams } from '../prisma/actor-message-record-mapper';
import { toRecordInstant } from '../prisma/instant-record-mapper';
import { resourcesOf } from '../prisma/tenant-ownership';

import type { Booking } from '../../domain/models/booking';
import type { BookingChange } from '../../domain/ports/booking.repository';
import type { WriteScope } from '../prisma/tenant-ownership';

/**
 * Writes the messages of a booking change inside its transaction, so a message never describes a
 * change that was rolled back. An employee is told through the member whose calendar they are; a
 * calendar that belongs to nobody is told nothing. The person who made the change finds their own
 * message already read: it is a record, not news.
 */
export async function writeNotices(
  { tx, scope, now }: WriteScope,
  booking: Booking,
  { notices = [], actorId }: Pick<BookingChange, 'notices' | 'actorId'>,
): Promise<void> {
  if (notices.length === 0) {
    return;
  }
  const people = await resourcesOf(scope, tx)
    .where((resource) => resource.id.in(notices.map(({ resourceId }) => resourceId)))
    .select('id', 'assignedActorId')
    .limit(notices.length)
    .all();
  const memberOf = new Map(people.map((person) => [person.id, person.assignedActorId]));
  const stamp = toRecordInstant(now);
  const params = toJsonValue(toMessageParams(booking));
  const rows = notices.flatMap(({ resourceId, type }) => {
    const recipientActorId = memberOf.get(resourceId) ?? null;
    return recipientActorId === null
      ? []
      : [
          {
            id: randomUUID(),
            tenantId: scope.tenantId,
            websiteId: scope.websiteId,
            recipientActorId,
            type,
            bookingId: booking.id,
            params,
            createdAt: stamp,
            readAt: recipientActorId === actorId ? stamp : null,
          },
        ];
  });
  if (rows.length > 0) {
    await tx.orm.public.ActorMessage.createAll(rows);
  }
}
