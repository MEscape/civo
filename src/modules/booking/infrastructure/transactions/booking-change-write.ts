import { BOOKING_ERROR_CODES as CODES } from '../../domain/errors/booking-errors';
import { asInstant, laterOf } from '../../domain/time/instant';
import { toAssignmentRows } from '../prisma/assignment-record-mapper';
import { toBookingChanges, toStatusRecord } from '../prisma/booking-record-mapper';
import { toRecordInstant, versionWindow } from '../prisma/instant-record-mapper';
import { assignmentsOf, bookingsOf } from '../prisma/tenant-ownership';

import { writeNotices } from './assignment-notices';
import { refused, reserve } from './write-outcome';

import type { WriteOutcome } from './write-outcome';
import type { BookingChange, NewBooking } from '../../domain/ports/booking.repository';
import type { WriteScope } from '../prisma/tenant-ownership';

/**
 * Writes the unit rows of a booking stored just before in the same transaction, and the messages that tell
 * its employees what it does to them: a new booking and a changed one end the same way.
 */
export async function storeUnits(
  write: WriteScope,
  stored: NewBooking,
  units: Pick<BookingChange, 'notices' | 'actorId'> & { readonly pooled: ReadonlySet<string> },
): Promise<void> {
  // @owner-scope child Every unit row carries the websiteId of the booking stored just before (`toAssignmentRows`).
  await write.tx.orm.public.BookingAssignment.createAll(
    toAssignmentRows(stored, write.scope.websiteId, units.pooled),
  );
  await writeNotices(write, stored.booking, units);
}

/**
 * Writes a change to an existing booking inside the transaction `write` runs in: the locks and the
 * checks of a live booking first, then the compare-and-swap of its row, then its units. Shared by the
 * repository's own `save` and by the writers that end bookings together with something else (closing
 * a service), so a booking is changed by exactly one piece of code.
 *
 * The expected status and timestamp in `where` are the compare-and-swap. It must be ONE statement:
 * `update()` of the ORM reads the row first and then writes it by key, which lets a second writer
 * through; `updateAndCount` filters in the UPDATE itself, and a writer that waited for the first
 * one's row lock re-checks the filter afterwards. The stamp is the compare-and-swap token of the next
 * writer, so it must differ from the one it replaces even when this clock is not past it (two writes
 * in one millisecond, a clock behind).
 */
export async function writeBookingChange(
  write: WriteScope,
  change: BookingChange,
): Promise<WriteOutcome> {
  const { stored, expected, now } = change;
  const { tx, scope } = write;
  const stamp = laterOf(now, asInstant(expected.updatedAt + 1));
  const reservation = await reserve(write, stored);
  if (reservation.kind === 'refused') {
    return reservation;
  }

  const swapped = await bookingsOf(scope, tx)
    .where({
      id: stored.booking.id,
      status: toStatusRecord(expected.status),
    })
    .where((booking) => booking.updatedAt.gte(versionWindow(expected.updatedAt).from))
    .where((booking) => booking.updatedAt.lt(versionWindow(expected.updatedAt).until))
    .updateAndCount({ ...toBookingChanges(stored), updatedAt: toRecordInstant(stamp) });
  if (swapped === 0) {
    return refused(CODES.bookingStale, 'The booking has changed.');
  }

  // Own old rows go first: they must not collide with the new span.
  await assignmentsOf(scope, tx).where({ bookingId: stored.booking.id }).deleteAndCount();
  await storeUnits(write, stored, { ...change, pooled: reservation.pooled });
  // The reference is not part of a change, so the answer carries the one that is stored.
  const identity = await bookingsOf(scope, tx)
    .where({ id: stored.booking.id })
    .select('reference')
    .first();
  if (identity === null) {
    return refused(CODES.bookingStale, 'The booking has changed.');
  }
  return {
    kind: 'stored',
    stored: {
      tenantId: scope.tenantId,
      booking: { ...stored.booking, updatedAt: stamp },
      placement: { ...stored.placement, reference: identity.reference },
    },
  };
}
