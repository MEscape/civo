import { unique } from '@lib/utils';

import { toRecordInstant } from '../prisma/instant-record-mapper';
import { assignmentsOf, bookingsOf } from '../prisma/tenant-ownership';

import type { TimeInterval } from '../../domain/time/time-interval';
import type { WriteScope } from '../prisma/tenant-ownership';

/**
 * Marks the given holds expired and frees what they held. Status and expiry are checked again in
 * the write itself: a hold that was confirmed a moment ago is not expired. This is the transition
 * of `expireHold` in the domain (status `expired`, no expiry kept) applied to many bookings in one
 * statement under its precondition (status `held`, expiry reached).
 */
export async function expireHolds(
  { tx, scope, now }: WriteScope,
  bookingIds: readonly string[],
): Promise<number> {
  if (bookingIds.length === 0) {
    return 0;
  }
  const ids = [...bookingIds];
  const stamp = toRecordInstant(now);
  const expired = await bookingsOf(scope, tx)
    .where({ status: 'HELD' })
    .where((booking) => booking.id.in(ids))
    .where((booking) => booking.holdExpiresAt.lte(stamp))
    .updateAndCount({ status: 'EXPIRED', holdExpiresAt: null, updatedAt: stamp });
  if (expired > 0) {
    await assignmentsOf(scope, tx)
      .where((unit) => unit.bookingId.in(ids))
      .where((unit) => unit.booking.some({ status: 'EXPIRED' }))
      .updateAndCount({ isActive: false });
  }
  return expired;
}

/**
 * Releases the holds that ran out where they stand in the way of `resourceIds` during `span`. An
 * expired hold stops blocking by the clock alone, but the exclusion constraint knows nothing of
 * clocks: its rows must be deactivated before a newcomer can take the place.
 */
export async function releaseExpiredHoldsOn(
  write: WriteScope,
  resourceIds: readonly string[],
  span: TimeInterval,
): Promise<void> {
  if (resourceIds.length === 0) {
    return;
  }
  const { tx, scope, now } = write;
  const rows = await assignmentsOf(scope, tx)
    .where((unit) => unit.resourceId.in([...resourceIds]))
    .where({ isActive: true })
    .where((unit) => unit.occupiedStart.lt(toRecordInstant(span.end)))
    .where((unit) => unit.occupiedEnd.gt(toRecordInstant(span.start)))
    .select('bookingId')
    .all();
  if (rows.length === 0) {
    return;
  }
  const due = await bookingsOf(scope, tx)
    .where({ status: 'HELD' })
    .where((booking) => booking.id.in(unique(rows.map((row) => row.bookingId))))
    .where((booking) => booking.holdExpiresAt.lte(toRecordInstant(now)))
    .select('id')
    .all();
  await expireHolds(
    write,
    due.map((row) => row.id),
  );
}
