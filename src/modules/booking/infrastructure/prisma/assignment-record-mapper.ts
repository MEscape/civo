import type { InstantRecord } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { literalGuard } from '@lib/utils';

import { bookingDataInvalid } from '../../domain/errors/booking-errors';
import { RESOURCE_TYPES } from '../../domain/models/bookable-resource';
import { isLiveStatus } from '../../domain/models/booking';
import { compareIds, toBookableResourceId } from '../../domain/models/ids';
import { createInterval } from '../../domain/time/time-interval';

import { readInstant, toRecordInstant } from './instant-record-mapper';

import type { Assignment } from '../../domain/models/booking';
import type { NewBooking } from '../../domain/ports/booking.repository';

/** One unit of a requirement as stored in `BookingAssignment`. */
export interface AssignmentRecord {
  readonly requirementIndex: number;
  readonly unitIndex: number;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly occupiedStart: InstantRecord;
  readonly occupiedEnd: InstantRecord;
}

export const ASSIGNMENT_SELECT = [
  'requirementIndex',
  'unitIndex',
  'resourceType',
  'resourceId',
  'occupiedStart',
  'occupiedEnd',
] as const satisfies ReadonlyArray<keyof AssignmentRecord>;

const isResourceKind = literalGuard(RESOURCE_TYPES);

/** The units in the order of their requirement and position. */
export function readAssignments(
  records: readonly AssignmentRecord[],
): AppResult<Assignment[], InfrastructureAppError> {
  const ordered = [...records].sort(
    (a, b) => a.requirementIndex - b.requirementIndex || a.unitIndex - b.unitIndex,
  );
  const assignments: Assignment[] = [];
  for (const record of ordered) {
    if (!isResourceKind(record.resourceType)) {
      return err(bookingDataInvalid('resourceType'));
    }
    const start = readInstant(record.occupiedStart);
    const end = readInstant(record.occupiedEnd);
    const occupied = start === null || end === null ? null : createInterval(start, end);
    if (occupied === null) {
      return err(bookingDataInvalid('unit span'));
    }
    assignments.push({
      requirementIndex: record.requirementIndex,
      resourceType: record.resourceType,
      resourceId: record.resourceId === null ? null : toBookableResourceId(record.resourceId),
      occupied,
    });
  }
  return ok(assignments);
}

/** Resources first, in id order; open units, which name none, last. */
function compareNullsLast(a: string | null, b: string | null): number {
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return compareIds(a, b);
}

/**
 * One row per unit of the booking. A row holds the span its resource is held for, repeats the
 * booking's session and says whether it still occupies the resource (only a live booking does; the row of a cancelled booking
 * stays as the record of who served it). Rows that name a resource come first, in id order, so two
 * transactions that want the same resources ask for them in the same order.
 */
/** `pooled`: the resources with several places, whose units take a place, not the whole resource. */
export function toAssignmentRows(
  stored: NewBooking,
  websiteId: string,
  pooled: ReadonlySet<string>,
) {
  const { booking, placement } = stored;
  const nextUnit = new Map<number, number>();
  const rows = booking.assignments.map((unit) => {
    const unitIndex = nextUnit.get(unit.requirementIndex) ?? 0;
    nextUnit.set(unit.requirementIndex, unitIndex + 1);
    return {
      bookingId: booking.id,
      requirementIndex: unit.requirementIndex,
      unitIndex,
      websiteId,
      resourceType: unit.resourceType,
      resourceId: unit.resourceId,
      occupiedStart: toRecordInstant(unit.occupied.start),
      occupiedEnd: toRecordInstant(unit.occupied.end),
      sessionKey: placement.sessionKey,
      isActive: isLiveStatus(booking.status),
      usesPlace: unit.resourceId !== null && pooled.has(unit.resourceId),
    };
  });
  return rows.sort((a, b) => compareNullsLast(a.resourceId, b.resourceId));
}
