import { randomUUID } from 'node:crypto';

import { toJsonValue } from '@lib/db';

import { CALENDAR_CHANGED } from '../../domain/models/actor-message';
import { toCalendarParams } from '../prisma/actor-message-record-mapper';
import { toRecordInstant } from '../prisma/instant-record-mapper';
import { resourcesOf } from '../prisma/tenant-ownership';

import type { CalendarNotice } from '../../domain/models/actor-message';
import type { WriteScope } from '../prisma/tenant-ownership';

/**
 * Writes the message that tells an employee a manager changed their calendar, inside the transaction of
 * the change, so the message exists exactly when the change committed. The employee is the member whose
 * calendar it is; a calendar that belongs to nobody, or a change that touched no part, tells nobody.
 */
export async function writeCalendarNotice(
  { tx, scope, now }: WriteScope,
  notice: CalendarNotice,
): Promise<void> {
  if (notice.parts.length === 0) {
    return;
  }
  const person = await resourcesOf(scope, tx)
    .where({ id: notice.resourceId })
    .select('assignedActorId')
    .first();
  if (person?.assignedActorId === null || person === null) {
    return;
  }
  await tx.orm.public.ActorMessage.createAll([
    {
      id: randomUUID(),
      tenantId: scope.tenantId,
      websiteId: scope.websiteId,
      recipientActorId: person.assignedActorId,
      type: CALENDAR_CHANGED,
      bookingId: null,
      params: toJsonValue(toCalendarParams(notice)),
      createdAt: toRecordInstant(now),
      readAt: null,
    },
  ]);
}
