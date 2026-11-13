import { normalizeEmail } from '../../domain/policies/customer-access';

import { ASSIGNMENT_SELECT } from './assignment-record-mapper';
import { BOOKING_SELECT, fromStatusRecord, toStatusRecord } from './booking-record-mapper';
import { toRecordInstant } from './instant-record-mapper';
import { bookingsOf } from './tenant-ownership';

import type { BookingStatus } from '../../domain/models/booking';
import type { BookableResourceId } from '../../domain/models/ids';
import type {
  BookingCountQuery,
  BookingListQuery,
  BookingScope,
  BookingStateCounts,
} from '../../domain/ports/booking.repository';
import type { TimeInterval } from '../../domain/time/time-interval';

/**
 * The bookings a list query asks for, before anything is selected: the page and its total start
 * from the same conditions, so they always agree.
 */
export function bookingsMatching(
  scope: BookingScope,
  {
    span,
    statuses,
    locationId,
    serviceId,
    resourceId,
    assignedActorId,
    customerEmail,
    reference,
    assignment,
  }: BookingCountQuery & Partial<Pick<BookingListQuery, 'statuses' | 'assignment'>>,
) {
  let records = bookingsOf(scope)
    .where((booking) => booking.start.gte(toRecordInstant(span.start)))
    .where((booking) => booking.start.lt(toRecordInstant(span.end)));
  if (statuses !== undefined) {
    records = records.where((booking) => booking.status.in(statuses.map(toStatusRecord)));
  }
  if (locationId !== undefined) {
    records = records.where({ locationId });
  }
  if (serviceId !== undefined) {
    records = records.where({ serviceId });
  }
  if (resourceId !== undefined) {
    records = records.where((booking) => booking.assignments.some({ resourceId }));
  }
  if (assignedActorId !== undefined) {
    // The employee's own bookings are a predicate of the statement, not a filter after the read.
    records = records.where((booking) =>
      booking.assignments.some((unit) =>
        unit.resource.some({ tenantId: scope.tenantId, assignedActorId }),
      ),
    );
  }
  if (customerEmail !== undefined) {
    records = records.where({ customerEmail: normalizeEmail(customerEmail) ?? '' });
  }
  if (reference !== undefined) {
    records = records.where({ reference });
  }
  if (assignment === 'open') {
    records = records.where((booking) => booking.assignments.some({ resourceId: null }));
  } else if (assignment === 'assigned') {
    records = records.where((booking) => booking.assignments.none({ resourceId: null }));
  }
  return records;
}

/** The counts of a list's states: one grouped count, and the confirmed bookings that still wait for an employee. */
export async function readStateCounts(
  scope: BookingScope,
  query: BookingCountQuery,
): Promise<BookingStateCounts> {
  const [rows, open] = await Promise.all([
    bookingsMatching(scope, query)
      .groupBy('status')
      .aggregate((aggregate) => ({ total: aggregate.count() })),
    bookingsMatching(scope, { ...query, statuses: ['confirmed'], assignment: 'open' }).aggregate(
      (aggregate) => ({ total: aggregate.count() }),
    ),
  ]);
  const byStatus: Partial<Record<BookingStatus, number>> = {};
  for (const row of rows) {
    const status = fromStatusRecord(row.status);
    if (status !== undefined) {
      byStatus[status] = row.total;
    }
  }
  return { byStatus, openConfirmed: open.total };
}

/** A booking with its units: one statement, never one per row. */
export function bookingsWithUnits(scope: BookingScope) {
  return bookingsOf(scope)
    .select(...BOOKING_SELECT)
    .include('assignments', (units) => units.select(...ASSIGNMENT_SELECT));
}

/** Bookings with their units whose occupied span overlaps `span`; with `resourceIds`, only those holding one of them. */
export function bookingsOverlapping(
  scope: BookingScope,
  span: TimeInterval,
  resourceIds?: readonly BookableResourceId[],
) {
  const records = bookingsWithUnits(scope)
    .where((booking) => booking.occupiedStart.lt(toRecordInstant(span.end)))
    .where((booking) => booking.occupiedEnd.gt(toRecordInstant(span.start)));
  return resourceIds === undefined
    ? records
    : records.where((booking) =>
        booking.assignments.some((unit) => unit.resourceId.in([...resourceIds])),
      );
}
