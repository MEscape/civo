import type { TenantId } from '@modules/auth';

import { createPersistenceFailures, dateToInstant, db, instantToDate } from '@lib/db';
import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BOOKING_ERROR_CODES,
  bookingConflict,
  bookingNotFound,
  bookingStale,
  capacityExceeded,
} from '../../domain/errors/booking-errors';
import { normalizeEmail } from '../../domain/models/booking-customer';
import { toBookingId } from '../../domain/models/ids';

import {
  BOOKING_HOLD_SELECT,
  BOOKING_SELECT,
  CALENDAR_STATUS_RECORDS,
  LIVE_STATUS_RECORDS,
  toBooking,
  toStatusRecord,
} from './booking-record-mapper';
import { restoreAll } from './restore-all-record-mapper';
import { toJsonValue } from './stored-json-record-mapper';
import { bookingsOf } from './tenant-ownership';

import type { BookingRecord } from './booking-record-mapper';
import type { Booking } from '../../domain/models/booking';
import type { BookingReference } from '../../domain/models/booking-reference';
import type { BookingId, WebsiteId } from '../../domain/models/ids';
import type {
  BookingFilter,
  BookingRepository,
  NewBooking,
} from '../../domain/ports/booking.repository';
import type { TimeInterval } from '../../domain/time/time-interval';

const failures = createPersistenceFailures({
  module: 'booking.persistence',
  code: BOOKING_ERROR_CODES.persistenceFailed,
  subject: 'Booking',
});

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The booking with the ids of the resources it holds: one statement, never one per row. */
const bookingsWithHolds = (tenantId: TenantId, source: Pick<Transaction, 'orm'> = db) =>
  source.orm.public.Booking.where({ tenantId })
    .select(...BOOKING_SELECT)
    .include('holds', (holds) => holds.select(...BOOKING_HOLD_SELECT));

/** What a write transaction can come out with besides a stored booking. */
type WriteOutcome =
  | { readonly kind: 'stored'; readonly booking: Booking }
  | { readonly kind: 'capacity-exceeded' }
  | { readonly kind: 'session-split' }
  | { readonly kind: 'stale' };

type WriteError = ConflictAppError | NotFoundAppError | InfrastructureAppError;

/** The transaction a write runs in, with the tenant it is scoped to and the moment it happens. */
interface WriteScope {
  readonly tx: Transaction;
  readonly tenantId: TenantId;
  readonly now: Date;
}

function isShared(sessionKey: string): boolean {
  return sessionKey.startsWith('session:');
}

/** Code-unit order, not locale order: the same ids sort the same way on every machine. */
function compareIds(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

/** The ids in code-unit order: every transaction takes row locks in the same order. */
function ordered<T extends string>(ids: readonly T[]): T[] {
  return [...ids].sort(compareIds);
}

/**
 * Serializes everything that adds participants to one shared session. The
 * exclusion constraint cannot do it: bookings of one session are SUPPOSED to
 * overlap on the same resources, so the limit on their participants is
 * checked in the application, and two requests checking at once would both
 * see room for the last place. The lock is released when the transaction ends.
 */
async function lockSession(tx: Transaction, sessionKey: string): Promise<void> {
  const plan = db.raw.sql`SELECT pg_advisory_xact_lock(hashtext(${sessionKey}))::text AS locked`
    .returnsRow({ locked: { codecId: 'pg/text@1', nullable: true } })
    .build();
  await tx.query(plan);
}

/**
 * Marks the given holds expired and releases what they held. The status and
 * expiry are checked again in the write itself: a hold that was confirmed a
 * moment ago is not expired.
 */
async function expireHolds(scope: WriteScope, bookingIds: readonly string[]): Promise<number> {
  if (bookingIds.length === 0) {
    return 0;
  }
  const { tx, tenantId, now } = scope;
  const ids = [...bookingIds];
  const expired = await tx.orm.public.Booking.where({ tenantId, status: 'HELD' })
    .where((booking) => booking.id.in(ids))
    .where((booking) => booking.holdExpiresAt.lte(dateToInstant(now)))
    .updateAndCount({ status: 'EXPIRED', updatedAt: dateToInstant(now) });
  if (expired > 0) {
    await tx.orm.public.BookingResource.where((hold) => hold.bookingId.in(ids))
      .where((hold) => hold.booking.some({ status: 'EXPIRED' }))
      .updateAndCount({ isActive: false });
  }
  return expired;
}

/**
 * Marks holds that ran out as expired where they stand in the way of
 * `resourceIds` during `span`. An expired hold stops blocking by the clock
 * alone, but the exclusion constraint knows nothing of clocks: its rows must
 * be deactivated before a newcomer can take the place.
 */
async function releaseExpiredHoldsOn(
  scope: WriteScope,
  resourceIds: readonly string[],
  span: TimeInterval,
): Promise<void> {
  const { tx, tenantId, now } = scope;
  const rows = await tx.orm.public.BookingResource.where((hold) =>
    hold.resourceId.in([...resourceIds]),
  )
    .where({ isActive: true })
    .where((hold) => hold.occupiedStart.lt(dateToInstant(new Date(span.end))))
    .where((hold) => hold.occupiedEnd.gt(dateToInstant(new Date(span.start))))
    .select('bookingId')
    .all();
  if (rows.length === 0) {
    return;
  }
  const candidates = [...new Set(rows.map((row) => row.bookingId))];
  const expired = await tx.orm.public.Booking.where({ tenantId, status: 'HELD' })
    .where((booking) => booking.id.in(candidates))
    .where((booking) => booking.holdExpiresAt.lte(dateToInstant(now)))
    .select('id')
    .all();
  await expireHolds(
    scope,
    expired.map((row) => row.id),
  );
}

type LiveSessionRow = Pick<BookingRecord, 'participants' | 'status' | 'holdExpiresAt' | 'holds'>;

const LIVE_SESSION_SELECT = [
  'participants',
  'status',
  'holdExpiresAt',
] as const satisfies ReadonlyArray<keyof LiveSessionRow>;

interface SessionState {
  readonly participants: number;
  readonly resourceKeys: ReadonlySet<string>;
}

/** The live bookings of a session other than `exceptId`: how many places are taken and on which resources. */
async function liveSession(
  scope: WriteScope,
  sessionKey: string,
  exceptId: string,
): Promise<SessionState> {
  const { tx, tenantId, now } = scope;
  const rows: readonly LiveSessionRow[] = await tx.orm.public.Booking.where({
    tenantId,
    sessionKey,
  })
    .where((booking) => booking.status.in([...LIVE_STATUS_RECORDS]))
    .where((booking) => booking.id.neq(exceptId))
    .select(...LIVE_SESSION_SELECT)
    .include('holds', (holds) => holds.select(...BOOKING_HOLD_SELECT))
    .all();
  let participants = 0;
  const resourceKeys = new Set<string>();
  for (const row of rows) {
    const holdEnd = row.holdExpiresAt === null ? null : instantToDate(row.holdExpiresAt);
    const live = row.status === 'CONFIRMED' || (holdEnd !== null && holdEnd > now);
    if (live) {
      participants += row.participants;
      resourceKeys.add(ordered(row.holds.map((hold) => hold.resourceId)).join(','));
    }
  }
  return { participants, resourceKeys };
}

/**
 * Checks a booking against the session it joins: the places must not run
 * out, and every booking of one session must hold the very same resources
 * (two requests that both started the session on different resources would
 * otherwise split it). Takes the session lock first.
 */
async function checkSession(
  scope: WriteScope,
  booking: NewBooking | Booking,
  exceptId: string,
): Promise<WriteOutcome | null> {
  if (!isShared(booking.sessionKey)) {
    return null;
  }
  await lockSession(scope.tx, booking.sessionKey);
  const session = await liveSession(scope, booking.sessionKey, exceptId);
  if (session.participants + booking.participants > booking.sessionCapacity) {
    return { kind: 'capacity-exceeded' };
  }
  const mine = ordered(booking.resourceIds).join(',');
  const consistent =
    session.resourceKeys.size === 0 ||
    (session.resourceKeys.size === 1 && session.resourceKeys.has(mine));
  return consistent ? null : { kind: 'session-split' };
}

function holdRows(booking: NewBooking | Booking, bookingId: string) {
  // Only a held or confirmed booking is ever written; the flag is what the constraint filters on.
  const isActive = booking.status === 'held' || booking.status === 'confirmed';
  return ordered(booking.resourceIds).map((resourceId) => ({
    bookingId,
    resourceId,
    occupiedStart: dateToInstant(booking.occupiedStart),
    occupiedEnd: dateToInstant(booking.occupiedEnd),
    sessionKey: booking.sessionKey,
    isActive,
  }));
}

function toColumns(booking: NewBooking | Booking) {
  return {
    serviceId: booking.serviceId,
    locationId: booking.locationId,
    reference: booking.reference,
    status: toStatusRecord(booking.status),
    start: dateToInstant(booking.start),
    end: dateToInstant(booking.end),
    occupiedStart: dateToInstant(booking.occupiedStart),
    occupiedEnd: dateToInstant(booking.occupiedEnd),
    participants: booking.participants,
    sessionKey: booking.sessionKey,
    sessionCapacity: booking.sessionCapacity,
    customer: booking.customer === null ? null : toJsonValue(booking.customer),
    customerEmail: booking.customer === null ? null : normalizeEmail(booking.customer.email),
    holdExpiresAt: booking.holdExpiresAt === null ? null : dateToInstant(booking.holdExpiresAt),
    rescheduleCount: booking.rescheduleCount,
    cancelledAt: booking.cancelledAt === null ? null : dateToInstant(booking.cancelledAt),
    cancelledBy: booking.cancelledBy,
  };
}

/**
 * Prisma 8 repository for bookings, and the place where double booking is
 * made impossible.
 *
 * Every booking writes one `BookingResource` row per held resource, repeating
 * the occupied span, session key and liveness; a Postgres exclusion
 * constraint on those rows refuses a second live booking of the same
 * resource in an overlapping span unless it belongs to the same shared
 * session. The check cannot be raced: the database serializes it. What the
 * constraint cannot express (the places of a shared session) is serialized
 * with an advisory lock taken on the session inside the writing transaction.
 */
export class PrismaBookingRepository implements BookingRepository {
  findById(
    id: BookingId,
    tenantId: TenantId,
  ): AppResultAsync<Booking | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => bookingsWithHolds(tenantId).where({ id }).first(),
      failures.infraOnly('findById'),
    ).andThen((record) => (record === null ? okAsync(null) : toBooking(record)));
  }

  findByReference(
    reference: BookingReference,
    websiteId: WebsiteId,
    tenantId: TenantId,
  ): AppResultAsync<Booking | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => bookingsWithHolds(tenantId).where({ reference, websiteId }).first(),
      failures.infraOnly('findByReference'),
    ).andThen((record) => (record === null ? okAsync(null) : toBooking(record)));
  }

  listBlocking(
    websiteId: WebsiteId,
    tenantId: TenantId,
    span: TimeInterval,
    limit: number,
  ): AppResultAsync<readonly Booking[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        bookingsWithHolds(tenantId)
          .where({ websiteId })
          .where((booking) => booking.status.in([...LIVE_STATUS_RECORDS]))
          .where((booking) => booking.occupiedStart.lt(dateToInstant(new Date(span.end))))
          .where((booking) => booking.occupiedEnd.gt(dateToInstant(new Date(span.start))))
          .orderBy([(booking) => booking.occupiedStart.asc(), (booking) => booking.id.asc()])
          .limit(limit)
          .all(),
      failures.infraOnly('listBlocking'),
    ).andThen((records) => restoreAll(records, toBooking));
  }

  listInRange(
    websiteId: WebsiteId,
    tenantId: TenantId,
    span: TimeInterval,
    filter: BookingFilter,
    limit: number,
  ): AppResultAsync<readonly Booking[], InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      let query = bookingsWithHolds(tenantId)
        .where({ websiteId })
        .where((booking) => booking.status.in([...CALENDAR_STATUS_RECORDS]))
        .where((booking) => booking.start.gte(dateToInstant(new Date(span.start))))
        .where((booking) => booking.start.lt(dateToInstant(new Date(span.end))));
      if (filter.locationId !== undefined) {
        query = query.where({ locationId: filter.locationId });
      }
      if (filter.serviceId !== undefined) {
        query = query.where({ serviceId: filter.serviceId });
      }
      const { resourceId } = filter;
      if (resourceId !== undefined) {
        query = query.where((booking) => booking.holds.some({ resourceId }));
      }
      return query
        .orderBy([(booking) => booking.start.asc(), (booking) => booking.id.asc()])
        .limit(limit)
        .all();
    }, failures.infraOnly('listInRange')).andThen((records) => restoreAll(records, toBooking));
  }

  create(input: NewBooking, now: Date): AppResultAsync<Booking, WriteError> {
    return fromThrowableAsync(
      () =>
        db.transaction(async (tx): Promise<WriteOutcome> => {
          const scope: WriteScope = { tx, tenantId: input.tenantId, now };
          const rejected = await checkSession(scope, input, '');
          if (rejected !== null) {
            return rejected;
          }
          await releaseExpiredHoldsOn(scope, input.resourceIds, {
            start: input.occupiedStart.getTime(),
            end: input.occupiedEnd.getTime(),
          });
          const stamp = dateToInstant(now);
          const created = await tx.orm.public.Booking.select('id').create({
            tenantId: input.tenantId,
            websiteId: input.websiteId,
            ...toColumns(input),
            createdAt: stamp,
            updatedAt: stamp,
          });
          await tx.orm.public.BookingResource.createAll(holdRows(input, created.id));
          const booking: Booking = {
            ...input,
            id: toBookingId(created.id),
            resourceIds: ordered(input.resourceIds),
            createdAt: now,
            updatedAt: now,
          };
          return { kind: 'stored', booking };
        }),
      failures.orConflict('create', bookingConflict),
    ).andThen((outcome) => this.settle(outcome));
  }

  save(
    next: Booking,
    expected: Pick<Booking, 'status' | 'updatedAt'>,
    now: Date,
  ): AppResultAsync<Booking, WriteError> {
    return fromThrowableAsync(
      () =>
        db.transaction(async (tx): Promise<WriteOutcome> => {
          const scope: WriteScope = { tx, tenantId: next.tenantId, now };
          const live = next.status === 'held' || next.status === 'confirmed';
          if (live) {
            const rejected = await checkSession(scope, next, next.id);
            if (rejected !== null) {
              return rejected;
            }
            await releaseExpiredHoldsOn(scope, next.resourceIds, {
              start: next.occupiedStart.getTime(),
              end: next.occupiedEnd.getTime(),
            });
          }

          // The expected status and timestamp in `where` are the compare-and-swap.
          const swapped = await tx.orm.public.Booking.where({
            id: next.id,
            tenantId: next.tenantId,
            status: toStatusRecord(expected.status),
            updatedAt: dateToInstant(expected.updatedAt),
          })
            .select('id')
            .update({ ...toColumns(next), updatedAt: dateToInstant(now) });
          if (swapped === null) {
            return { kind: 'stale' };
          }

          // Own old rows go first: they must not collide with the new span.
          await tx.orm.public.BookingResource.where({ bookingId: next.id }).deleteAndCount();
          if (live) {
            await tx.orm.public.BookingResource.createAll(holdRows(next, next.id));
          }
          return {
            kind: 'stored',
            booking: { ...next, resourceIds: ordered(next.resourceIds), updatedAt: now },
          };
        }),
      failures.orConflict('save', bookingConflict),
    ).andThen((outcome) =>
      outcome.kind === 'stale' ? this.explainStale(next) : this.settle(outcome),
    );
  }

  countLiveByEmail(
    websiteId: WebsiteId,
    tenantId: TenantId,
    email: string,
    now: Date,
  ): AppResultAsync<number, InfrastructureAppError> {
    const customerEmail = normalizeEmail(email);
    const stamp = dateToInstant(now);
    return fromThrowableAsync(async () => {
      const own = bookingsOf(tenantId).where({ websiteId, customerEmail });
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
    websiteId: WebsiteId,
    tenantId: TenantId,
    now: Date,
  ): AppResultAsync<number, InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      const held = await bookingsOf(tenantId)
        .where({ websiteId, status: 'HELD' })
        .where((booking) => booking.holdExpiresAt.gt(dateToInstant(now)))
        .aggregate((aggregate) => ({ total: aggregate.count() }));
      return held.total;
    }, failures.infraOnly('countLiveHolds'));
  }

  releaseExpiredHolds(
    websiteId: WebsiteId,
    tenantId: TenantId,
    now: Date,
    limit: number,
  ): AppResultAsync<number, InfrastructureAppError> {
    return fromThrowableAsync(
      () =>
        db.transaction(async (tx) => {
          const due = await tx.orm.public.Booking.where({ tenantId, websiteId, status: 'HELD' })
            .where((booking) => booking.holdExpiresAt.lte(dateToInstant(now)))
            .orderBy([(booking) => booking.holdExpiresAt.asc(), (booking) => booking.id.asc()])
            .select('id')
            .limit(limit)
            .all();
          return expireHolds(
            { tx, tenantId, now },
            due.map((row) => row.id),
          );
        }),
      failures.infraOnly('releaseExpiredHolds'),
    );
  }

  private settle(outcome: WriteOutcome): AppResultAsync<Booking, WriteError> {
    switch (outcome.kind) {
      case 'stored':
        return okAsync(outcome.booking);
      case 'capacity-exceeded':
        return errAsync(capacityExceeded());
      case 'session-split':
        return errAsync(bookingConflict());
      case 'stale':
        return errAsync(bookingStale());
    }
  }

  /** The swap matched nothing: either the booking is gone (or another tenant's) or it changed. */
  private explainStale(next: Booking): AppResultAsync<Booking, WriteError> {
    return fromThrowableAsync(
      async () => bookingsOf(next.tenantId).where({ id: next.id }).select('id').first(),
      failures.infraOnly('explainStale'),
    ).andThen((row) => errAsync(row === null ? bookingNotFound() : bookingStale()));
  }
}
