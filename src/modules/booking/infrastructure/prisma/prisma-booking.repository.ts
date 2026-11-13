import { createPersistenceFailures, db, retryTransient } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { combine, errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BOOKING_ERROR_CODES as CODES,
  bookingConflict,
  bookingDataInvalid,
  bookingNotFound,
} from '../../domain/errors/booking-errors';
import { compareIds } from '../../domain/models/ids';
import { normalizeEmail } from '../../domain/policies/customer-access';
import { storeUnits, writeBookingChange } from '../transactions/booking-change-write';
import { expireHolds } from '../transactions/expired-holds';
import { conflictOf, reserve, settle } from '../transactions/write-outcome';

import { ASSIGNMENT_SELECT } from './assignment-record-mapper';
import {
  bookingsMatching,
  bookingsOverlapping,
  bookingsWithUnits,
  readStateCounts,
} from './booking-ownership';
import {
  BOOKING_SELECT,
  hasBrokenInvariants,
  toBookingColumns,
  toStoredBooking,
} from './booking-record-mapper';
import { toRecordInstant } from './instant-record-mapper';
import { bookingsOf } from './tenant-ownership';

import type { BookingRecord } from './booking-record-mapper';
import type { WriteScope } from './tenant-ownership';
import type { BookingId } from '../../domain/models/ids';
import type {
  BlockingBookings,
  BlockingQuery,
  BookingChange,
  BookingCountQuery,
  BookingCreation,
  BookingListQuery,
  BookingRepository,
  BookingScope,
  BookingStateCounts,
  BookingWriteError,
  OpenBookingQuery,
  StoredBooking,
} from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';
import type { WriteOutcome } from '../transactions/write-outcome';

const failures = createPersistenceFailures({
  module: 'booking.persistence',
  code: CODES.persistenceFailed,
  subject: 'Booking',
});

const readStored = (record: BookingRecord | null) =>
  record === null ? okAsync(null) : toStoredBooking(record);

const readAll = (records: readonly BookingRecord[]) =>
  combine(records.map((record) => toStoredBooking(record)));

/** The earliest first, then by id: the order every list of this repository has. */
const byOccupiedStart = (a: StoredBooking, b: StoredBooking) =>
  a.booking.occupied.start - b.booking.occupied.start || compareIds(a.booking.id, b.booking.id);

/**
 * Prisma 8 repository for bookings, and the place where double booking is made impossible.
 *
 * Every unit is a `BookingAssignment` row repeating the occupied span, session key and liveness.
 * All writers take transaction-scoped resource locks before checking committed occupancy,
 * including employees with one place; a full resource returns `booking.resource_taken` and keeps
 * none of the write. Shared sessions have a separate capacity lock, and expired holds are released.
 * The current DB contract has no exclusion constraint: direct SQL writers must obey this protocol
 * until a reviewed constraint migration provides that additional database guarantee.
 * A change to an existing booking is a compare-and-swap
 * on its status and `updatedAt`, so it never overwrites what moved on after the read
 * (`booking.stale`).
 *
 * A write is retried as a whole when the database aborts it as a deadlock or a serialization
 * failure; the retry runs the transaction from its first statement, so it reads again. A conflict is
 * permanent and is not retried.
 */
export class PrismaBookingRepository implements BookingRepository {
  findById(
    scope: BookingScope,
    id: BookingId,
  ): AppResultAsync<StoredBooking | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => bookingsWithUnits(scope).where({ id }).first(),
      failures.infraOnly('findById'),
    ).andThen(readStored);
  }

  findByReference(
    scope: BookingScope,
    reference: string,
  ): AppResultAsync<StoredBooking | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => bookingsWithUnits(scope).where({ reference }).first(),
      failures.infraOnly('findByReference'),
    ).andThen(readStored);
  }

  listBlocking(
    scope: BookingScope,
    { span, now, resourceIds, limit }: BlockingQuery,
  ): AppResultAsync<BlockingBookings, InfrastructureAppError> {
    if (resourceIds?.length === 0) {
      return okAsync({ bookings: [], isComplete: true });
    }
    const overlapping = () =>
      bookingsOverlapping(scope, span, resourceIds)
        .orderBy([(booking) => booking.occupiedStart.asc(), (booking) => booking.id.asc()])
        // One more than asked for: it tells a full answer from a cut one.
        .limit(limit + 1);
    return fromThrowableAsync(async () => {
      // A hold that ran out blocks nothing, so the clock is part of the statement and not of the
      // caller's filter: the limit must not be spent on rows that do not count.
      const confirmed = await overlapping().where({ status: 'CONFIRMED' }).all();
      const holds = await overlapping()
        .where({ status: 'HELD' })
        .where((booking) => booking.holdExpiresAt.gt(toRecordInstant(now)))
        .all();
      return [...confirmed, ...holds];
    }, failures.infraOnly('listBlocking')).andThen((records) =>
      readAll(records).map((all) => {
        const sorted = all.sort(byOccupiedStart);
        return { bookings: sorted.slice(0, limit), isComplete: sorted.length <= limit };
      }),
    );
  }

  list(
    scope: BookingScope,
    query: BookingListQuery,
  ): AppResultAsync<readonly StoredBooking[], InfrastructureAppError> {
    if (query.statuses.length === 0) {
      return okAsync([]);
    }
    return fromThrowableAsync(async () => {
      return bookingsMatching(scope, query)
        .select(...BOOKING_SELECT)
        .include('assignments', (units) => units.select(...ASSIGNMENT_SELECT))
        .orderBy([(booking) => booking.start.asc(), (booking) => booking.id.asc()])
        .limit(query.limit)
        .offset(query.offset ?? 0)
        .all();
    }, failures.infraOnly('list')).andThen(readAll);
  }

  count(
    scope: BookingScope,
    query: BookingListQuery,
  ): AppResultAsync<number, InfrastructureAppError> {
    if (query.statuses.length === 0) {
      return okAsync(0);
    }
    return fromThrowableAsync(async () => {
      const { total } = await bookingsMatching(scope, query).aggregate((aggregate) => ({
        total: aggregate.count(),
      }));
      return total;
    }, failures.infraOnly('count'));
  }

  countByState(
    scope: BookingScope,
    query: BookingCountQuery,
  ): AppResultAsync<BookingStateCounts, InfrastructureAppError> {
    return fromThrowableAsync(
      () => readStateCounts(scope, query),
      failures.infraOnly('countByState'),
    );
  }

  countLiveByEmail(
    scope: BookingScope,
    email: string,
    now: Instant,
  ): AppResultAsync<number, InfrastructureAppError> {
    const customerEmail = normalizeEmail(email) ?? '';
    const stamp = toRecordInstant(now);
    return fromThrowableAsync(async () => {
      const own = bookingsOf(scope).where({ customerEmail });
      const confirmed = await own
        .where({ status: 'CONFIRMED' })
        .where((booking) => booking.end.gt(stamp))
        .aggregate((aggregate) => ({ total: aggregate.count() }));
      const held = await own
        .where({ status: 'HELD' })
        .where((booking) => booking.holdExpiresAt.gt(stamp))
        .aggregate((aggregate) => ({ total: aggregate.count() }));
      return confirmed.total + held.total;
    }, failures.infraOnly('countLiveByEmail'));
  }

  countLiveHolds(
    scope: BookingScope,
    now: Instant,
  ): AppResultAsync<number, InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      const held = await bookingsOf(scope)
        .where({ status: 'HELD' })
        .where((booking) => booking.holdExpiresAt.gt(toRecordInstant(now)))
        .aggregate((aggregate) => ({ total: aggregate.count() }));
      return held.total;
    }, failures.infraOnly('countLiveHolds'));
  }

  listOpen(
    scope: BookingScope,
    { now, locationId, limit }: OpenBookingQuery,
  ): AppResultAsync<readonly StoredBooking[], InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      let query = bookingsWithUnits(scope)
        .where({ status: 'CONFIRMED' })
        .where((booking) => booking.end.gt(toRecordInstant(now)))
        .where((booking) => booking.assignments.some({ resourceId: null }));
      if (locationId !== undefined) {
        query = query.where({ locationId });
      }
      return query
        .orderBy([(booking) => booking.start.asc(), (booking) => booking.id.asc()])
        .limit(limit)
        .all();
    }, failures.infraOnly('listOpen')).andThen(readAll);
  }

  create(
    scope: BookingScope,
    stored: BookingCreation,
    now: Instant,
  ): AppResultAsync<StoredBooking, BookingWriteError> {
    if (hasBrokenInvariants(stored.booking)) {
      return errAsync(bookingDataInvalid('invariants'));
    }
    return fromThrowableAsync(
      () =>
        retryTransient(() =>
          db.transaction(async (tx): Promise<WriteOutcome> => {
            const write: WriteScope = { tx, scope, now };
            const reservation = await reserve(write, stored);
            if (reservation.kind === 'refused') {
              return reservation;
            }
            const stamp = toRecordInstant(now);
            await tx.orm.public.Booking.select('id').create({
              id: stored.booking.id,
              tenantId: scope.tenantId,
              websiteId: scope.websiteId,
              ...toBookingColumns(stored),
              createdAt: stamp,
              updatedAt: stamp,
            });
            await storeUnits(write, stored, { ...stored, pooled: reservation.pooled });
            return {
              kind: 'stored',
              stored: {
                ...stored,
                tenantId: scope.tenantId,
                booking: { ...stored.booking, createdAt: now, updatedAt: now },
              },
            };
          }),
        ),
      failures.orConflict('create', conflictOf),
    ).andThen(settle);
  }

  save(
    scope: BookingScope,
    change: BookingChange,
  ): AppResultAsync<StoredBooking, BookingWriteError> {
    if (hasBrokenInvariants(change.stored.booking)) {
      return errAsync(bookingDataInvalid('invariants'));
    }
    return fromThrowableAsync(
      () =>
        retryTransient(() =>
          db.transaction(async (tx): Promise<WriteOutcome> =>
            writeBookingChange({ tx, scope, now: change.now }, change),
          ),
        ),
      failures.orConflict('save', conflictOf),
    ).andThen((outcome) =>
      outcome.kind === 'refused' && outcome.error.code === CODES.bookingStale
        ? this.explainStale(scope, change.stored.booking.id)
        : settle(outcome),
    );
  }

  releaseExpiredHolds(
    scope: BookingScope,
    now: Instant,
    limit: number,
  ): AppResultAsync<number, InfrastructureAppError> {
    return fromThrowableAsync(
      () =>
        retryTransient(() =>
          db.transaction(async (tx) => {
            const due = await bookingsOf(scope, tx)
              .where({ status: 'HELD' })
              .where((booking) => booking.holdExpiresAt.lte(toRecordInstant(now)))
              .orderBy([(booking) => booking.holdExpiresAt.asc(), (booking) => booking.id.asc()])
              .select('id')
              .limit(limit)
              .all();
            return expireHolds(
              { tx, scope, now },
              due.map((row) => row.id),
            );
          }),
        ),
      failures.infraOnly('releaseExpiredHolds'),
    );
  }

  /** The swap matched nothing: either the booking is gone (or another website's) or it changed. */
  private explainStale(
    scope: BookingScope,
    id: BookingId,
  ): AppResultAsync<StoredBooking, BookingWriteError> {
    return fromThrowableAsync(
      async () => bookingsOf(scope).where({ id }).select('id').first(),
      failures.infraOnly('explainStale'),
    ).andThen((row) =>
      errAsync(
        row === null
          ? bookingNotFound()
          : bookingConflict(CODES.bookingStale, 'The booking has changed.'),
      ),
    );
  }
}

/** The one instance the composition root wires (the adapter holds no state). */
export const prismaBookingRepository = new PrismaBookingRepository();
