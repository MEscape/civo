import { advisoryLock } from '@lib/db';
import type { InstantRecord } from '@lib/db';
import { isDefined } from '@lib/utils';

import { heldResourceIds } from '../../domain/models/booking';
import { isSharedSession } from '../../domain/models/booking-session';
import { compareIds } from '../../domain/models/ids';
import { recordMillis } from '../prisma/instant-record-mapper';
import { bookingsOf } from '../prisma/tenant-ownership';

import type { NewBooking } from '../../domain/ports/booking.repository';
import type { BookingStatusRecord } from '../prisma/booking-record-mapper';
import type { WriteScope } from '../prisma/tenant-ownership';

/** Why a booking cannot join its shared session. */
export type SessionRefusal = 'capacity-exceeded' | 'session-split';

/** What the check needs of the other bookings of a session. */
interface SessionRow {
  readonly participants: number;
  readonly status: BookingStatusRecord;
  readonly holdExpiresAt: InstantRecord | null;
  readonly assignments: ReadonlyArray<{ readonly resourceId: string | null }>;
}

const LIVE_STATUSES = ['HELD', 'CONFIRMED'] as const;

const resourceKey = (ids: readonly string[]) => [...ids].sort(compareIds).join(',');

/**
 * Checks a booking against the shared session it joins: the places must not run out, and every
 * booking of one session must hold the very same resources (two requests that both started the
 * session on different resources would otherwise split it). Takes the session lock first, because
 * the exclusion constraint cannot do this: bookings of one session are SUPPOSED to overlap on the
 * same resources, and two requests counting at once would both see room for the last place. A
 * booking alone in its session needs none of it: the exclusion constraint covers it.
 */
export async function checkSession(
  { tx, scope, now }: WriteScope,
  stored: NewBooking,
): Promise<SessionRefusal | null> {
  const { sessionKey, participants, sessionCapacity } = stored.placement;
  if (!isSharedSession(sessionKey)) {
    return null;
  }
  await advisoryLock(tx, `booking-session:${scope.websiteId}:${sessionKey}`);
  const others: readonly SessionRow[] = await bookingsOf(scope, tx)
    .where({ sessionKey })
    .where((booking) => booking.status.in([...LIVE_STATUSES]))
    .where((booking) => booking.id.neq(stored.booking.id))
    .select('participants', 'status', 'holdExpiresAt')
    .include('assignments', (units) => units.select('resourceId'))
    .all();
  // A hold counts until it runs out, whether or not anything has marked it expired yet.
  const live = others.filter(
    (other) =>
      other.status === 'CONFIRMED' ||
      (other.holdExpiresAt !== null && recordMillis(other.holdExpiresAt) > now),
  );
  const taken = live.reduce((sum, other) => sum + other.participants, 0);
  if (taken + participants > sessionCapacity) {
    return 'capacity-exceeded';
  }
  const keys = new Set(
    live.map((other) =>
      resourceKey(other.assignments.map((unit) => unit.resourceId).filter(isDefined)),
    ),
  );
  const mine = resourceKey(heldResourceIds(stored.booking));
  return keys.size === 0 || (keys.size === 1 && keys.has(mine)) ? null : 'session-split';
}
