import { toTenantId } from '@modules/auth';

import { toJsonValue } from '@lib/db';
import type { InstantRecord } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { isDefined, omit } from '@lib/utils';

import { bookingDataInvalid } from '../../domain/errors/booking-errors';
import { findInvariantViolations } from '../../domain/lifecycle/booking-invariants';
import { toBookableServiceId, toBookingId, toBookingLocationId } from '../../domain/models/ids';
import { createInterval } from '../../domain/time/time-interval';

import { readAssignments } from './assignment-record-mapper';
import { customerEmailOf, readCanceller, readCustomer } from './booking-customer-record-mapper';
import { readInstant, readOptionalInstant, toRecordInstant } from './instant-record-mapper';
import { readSnapshot } from './service-snapshot-record-mapper';

import type { AssignmentRecord } from './assignment-record-mapper';
import type { Booking, BookingStatus } from '../../domain/models/booking';
import type {
  BookingPlacement,
  NewBooking,
  StoredBooking,
} from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';
import type { TimeInterval } from '../../domain/time/time-interval';

export type BookingStatusRecord =
  'HELD' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW' | 'EXPIRED';

const STATUS_BY_RECORD = {
  HELD: 'held',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
  EXPIRED: 'expired',
} as const satisfies Record<BookingStatusRecord, BookingStatus>;

const RECORD_BY_STATUS = {
  held: 'HELD',
  confirmed: 'CONFIRMED',
  cancelled: 'CANCELLED',
  completed: 'COMPLETED',
  no_show: 'NO_SHOW',
  expired: 'EXPIRED',
} as const satisfies Record<BookingStatus, BookingStatusRecord>;

export const toStatusRecord = (status: BookingStatus): BookingStatusRecord =>
  RECORD_BY_STATUS[status];

/** The status a stored enum value names; `undefined` for a value the module does not know. */
export const fromStatusRecord = (record: string): BookingStatus | undefined =>
  Object.hasOwn(STATUS_BY_RECORD, record)
    ? STATUS_BY_RECORD[record as BookingStatusRecord]
    : undefined;

/** A booking with its units, as the database returns it. */
export interface BookingRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly serviceId: string;
  readonly locationId: string;
  readonly reference: string;
  readonly status: BookingStatusRecord;
  readonly start: InstantRecord;
  readonly end: InstantRecord;
  readonly occupiedStart: InstantRecord;
  readonly occupiedEnd: InstantRecord;
  readonly participants: number;
  readonly sessionKey: string;
  readonly sessionCapacity: number;
  readonly customer: unknown;
  readonly serviceSnapshot: unknown;
  /** Optional so that a record built by hand (a test) may leave it out. */
  readonly locale?: string | null;
  readonly holdExpiresAt: InstantRecord | null;
  readonly rescheduleCount: number;
  readonly cancelledAt: InstantRecord | null;
  readonly cancelledBy: string | null;
  readonly createdAt: InstantRecord;
  readonly updatedAt: InstantRecord;
  readonly assignments: readonly AssignmentRecord[];
}

export const BOOKING_SELECT = [
  'id',
  'tenantId',
  'serviceId',
  'locationId',
  'reference',
  'status',
  'start',
  'end',
  'occupiedStart',
  'occupiedEnd',
  'participants',
  'sessionKey',
  'sessionCapacity',
  'customer',
  'serviceSnapshot',
  'locale',
  'holdExpiresAt',
  'rescheduleCount',
  'cancelledAt',
  'cancelledBy',
  'createdAt',
  'updatedAt',
] as const satisfies ReadonlyArray<keyof Omit<BookingRecord, 'assignments'>>;

interface StoredTimes {
  readonly start: Instant;
  readonly end: Instant;
  readonly occupied: TimeInterval;
  readonly holdExpiresAt: Instant | null;
  readonly cancelledAt: Instant | null;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

/** `null` when any stored time is outside what the rules can hold. */
function readTimes(record: BookingRecord): StoredTimes | null {
  const start = readInstant(record.start);
  const end = readInstant(record.end);
  const occupiedStart = readInstant(record.occupiedStart);
  const occupiedEnd = readInstant(record.occupiedEnd);
  const createdAt = readInstant(record.createdAt);
  const updatedAt = readInstant(record.updatedAt);
  const holdExpiresAt = readOptionalInstant(record.holdExpiresAt);
  const cancelledAt = readOptionalInstant(record.cancelledAt);
  if (
    start === null ||
    end === null ||
    occupiedStart === null ||
    occupiedEnd === null ||
    createdAt === null ||
    updatedAt === null ||
    holdExpiresAt === undefined ||
    cancelledAt === undefined
  ) {
    return null;
  }
  const occupied = createInterval(occupiedStart, occupiedEnd);
  return occupied === null
    ? null
    : { start, end, occupied, holdExpiresAt, cancelledAt, createdAt, updatedAt };
}

/**
 * The booking as the rules know it, or a persistence failure: a stored row that breaks the
 * booking's own invariants is refused here, not acted on.
 */
export function toStoredBooking(
  record: BookingRecord,
): AppResult<StoredBooking, InfrastructureAppError> {
  const times = readTimes(record);
  if (times === null) {
    return err(bookingDataInvalid('instant'));
  }
  const customer = readCustomer(record.customer);
  const cancelledBy = readCanceller(record.cancelledBy);
  const assignments = readAssignments(record.assignments);
  const snapshot = readSnapshot(record.serviceSnapshot);
  if (snapshot.isErr()) {
    return err(snapshot.error);
  }
  if (customer.isErr()) {
    return err(customer.error);
  }
  if (cancelledBy.isErr()) {
    return err(cancelledBy.error);
  }
  if (assignments.isErr()) {
    return err(assignments.error);
  }
  const booking: Booking = {
    id: toBookingId(record.id),
    serviceId: toBookableServiceId(record.serviceId),
    locationId: toBookingLocationId(record.locationId),
    status: STATUS_BY_RECORD[record.status],
    start: times.start,
    end: times.end,
    occupied: times.occupied,
    assignments: assignments.value,
    customer: customer.value,
    holdExpiresAt: times.holdExpiresAt,
    rescheduleCount: record.rescheduleCount,
    cancelledAt: times.cancelledAt,
    cancelledBy: cancelledBy.value,
    createdAt: times.createdAt,
    updatedAt: times.updatedAt,
  };
  if (hasBrokenInvariants(booking)) {
    return err(bookingDataInvalid('invariants'));
  }
  const placement: BookingPlacement = {
    reference: record.reference,
    participants: record.participants,
    sessionKey: record.sessionKey,
    sessionCapacity: record.sessionCapacity,
    snapshot: snapshot.value,
    ...(isDefined(record.locale) ? { locale: record.locale } : {}),
  };
  return ok({ tenantId: toTenantId(record.tenantId), booking, placement });
}

/** Whether a booking breaks one of its own invariants (`findInvariantViolations`): refused on the way in and out. */
export function hasBrokenInvariants(booking: Booking): boolean {
  return findInvariantViolations(booking).length > 0;
}

/** The columns of a new booking: everything except the id and the tenant, which the caller names. */
export function toBookingColumns({ booking, placement }: NewBooking) {
  return {
    serviceId: booking.serviceId,
    locationId: booking.locationId,
    reference: placement.reference,
    status: toStatusRecord(booking.status),
    start: toRecordInstant(booking.start),
    end: toRecordInstant(booking.end),
    occupiedStart: toRecordInstant(booking.occupied.start),
    occupiedEnd: toRecordInstant(booking.occupied.end),
    participants: placement.participants,
    sessionKey: placement.sessionKey,
    sessionCapacity: placement.sessionCapacity,
    customer: booking.customer === null ? null : toJsonValue(booking.customer),
    serviceSnapshot: placement.snapshot === null ? null : toJsonValue(placement.snapshot),
    locale: placement.locale ?? null,
    customerEmail: customerEmailOf(booking.customer),
    holdExpiresAt: booking.holdExpiresAt === null ? null : toRecordInstant(booking.holdExpiresAt),
    rescheduleCount: booking.rescheduleCount,
    cancelledAt: booking.cancelledAt === null ? null : toRecordInstant(booking.cancelledAt),
    cancelledBy: booking.cancelledBy,
  };
}

/**
 * The columns a change may write. The reference is the booking's identity for the visitor and, like
 * the language it was made in, never changes; a move may change the session (its key follows the start).
 */
export function toBookingChanges(stored: NewBooking) {
  return omit(toBookingColumns(stored), ['reference', 'locale']);
}
