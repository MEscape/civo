import { toTenantId } from '@modules/auth';

import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { persistenceFailed } from '../../domain/errors/booking-errors';
import { toBookingReference } from '../../domain/models/booking-reference';
import {
  toBookableResourceId,
  toBookableServiceId,
  toBookingId,
  toBookingLocationId,
  toWebsiteId,
} from '../../domain/models/ids';

import { storedBookingSchema } from './stored-json-record-mapper';

import type { Booking, BookingStatus } from '../../domain/models/booking';

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

/** The statuses under which a booking occupies its resources. */
export const LIVE_STATUS_RECORDS = [
  'HELD',
  'CONFIRMED',
] as const satisfies readonly BookingStatusRecord[];

/** The statuses the operations calendar shows. */
export const CALENDAR_STATUS_RECORDS = [
  'HELD',
  'CONFIRMED',
  'COMPLETED',
  'NO_SHOW',
] as const satisfies readonly BookingStatusRecord[];

export interface BookingHoldRecord {
  readonly resourceId: string;
}

export interface BookingRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly websiteId: string;
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
  readonly holdExpiresAt: InstantRecord | null;
  readonly rescheduleCount: number;
  readonly cancelledAt: InstantRecord | null;
  readonly cancelledBy: string | null;
  readonly createdAt: InstantRecord;
  readonly updatedAt: InstantRecord;
  readonly holds: readonly BookingHoldRecord[];
}

export const BOOKING_SELECT = [
  'id',
  'tenantId',
  'websiteId',
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
  'holdExpiresAt',
  'rescheduleCount',
  'cancelledAt',
  'cancelledBy',
  'createdAt',
  'updatedAt',
] as const satisfies ReadonlyArray<keyof Omit<BookingRecord, 'holds'>>;

export const BOOKING_HOLD_SELECT = ['resourceId'] as const satisfies ReadonlyArray<
  keyof BookingHoldRecord
>;

function toOptionalDate(instant: InstantRecord | null): Date | null {
  return instant === null ? null : instantToDate(instant);
}

/** Code-unit order, not locale order: the same ids sort the same way on every machine. */
function compareIds(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

/** Resources in code-unit order, the order every other part of the module uses. */
function sortedIds(holds: readonly BookingHoldRecord[]) {
  return holds
    .map((hold) => hold.resourceId)
    .sort(compareIds)
    .map(toBookableResourceId);
}

export function toBooking(record: BookingRecord): AppResult<Booking, InfrastructureAppError> {
  const stored = storedBookingSchema.safeParse(record);
  if (!stored.success) {
    return err(persistenceFailed(stored.error));
  }
  return ok({
    id: toBookingId(record.id),
    tenantId: toTenantId(record.tenantId),
    websiteId: toWebsiteId(record.websiteId),
    serviceId: toBookableServiceId(record.serviceId),
    locationId: toBookingLocationId(record.locationId),
    reference: toBookingReference(record.reference),
    status: STATUS_BY_RECORD[record.status],
    start: instantToDate(record.start),
    end: instantToDate(record.end),
    occupiedStart: instantToDate(record.occupiedStart),
    occupiedEnd: instantToDate(record.occupiedEnd),
    participants: record.participants,
    resourceIds: sortedIds(record.holds),
    sessionKey: record.sessionKey,
    sessionCapacity: record.sessionCapacity,
    customer: stored.data.customer,
    holdExpiresAt: toOptionalDate(record.holdExpiresAt),
    rescheduleCount: record.rescheduleCount,
    cancelledAt: toOptionalDate(record.cancelledAt),
    cancelledBy: stored.data.cancelledBy,
    createdAt: instantToDate(record.createdAt),
    updatedAt: instantToDate(record.updatedAt),
  });
}
