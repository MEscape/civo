import type { InstantRecord } from '@lib/db';
import { isDefined } from '@lib/utils';

import { placesOf } from '../../domain/models/bookable-resource';
import { asInstant } from '../../domain/time/instant';
import { intervalsAtDepth, listOverlaps, mergeIntervals } from '../../domain/time/time-interval';
import { recordMillis, toRecordInstant } from '../prisma/instant-record-mapper';
import { assignmentsOf, resourcesOf } from '../prisma/tenant-ownership';

import type { NewBooking } from '../../domain/ports/booking.repository';
import type { TimeInterval } from '../../domain/time/time-interval';
import type { WriteScope } from '../prisma/tenant-ownership';

/** What the count needs of a unit of another booking. */
interface PlaceRow {
  readonly resourceId: string | null;
  readonly sessionKey: string;
  readonly occupiedStart: InstantRecord;
  readonly occupiedEnd: InstantRecord;
}

/** What the place check found: whether a resource is full, and which resources have several places. */
export interface PlaceCheck {
  readonly isFull: boolean;
  /** Resources with more than one place: their units take a place instead of the whole resource. */
  readonly pooled: ReadonlySet<string>;
}

/**
 * Counts every resource a live booking holds, including employees, who always have one place.
 * Runs under the resource locks, after expired holds are released, so concurrent writers see
 * committed occupancy before reserving. The current contract does not declare an exclusion
 * constraint; employees must not bypass this check. Resources narrowed from several places to
 * one are counted too. Bookings of one shared session take one place together.
 */
export async function checkPlaces(
  { tx, scope }: WriteScope,
  stored: NewBooking,
): Promise<PlaceCheck> {
  const units = stored.booking.assignments.filter((unit) => unit.resourceId !== null);
  const ids = units.map((unit) => unit.resourceId).filter(isDefined);
  if (ids.length === 0) {
    return { isFull: false, pooled: new Set() };
  }
  const resources = await resourcesOf(scope, tx)
    .where((resource) => resource.id.in(ids))
    .select('id', 'type', 'capacity')
    .all();
  const places = new Map(resources.map((resource) => [resource.id, placesOf(resource)]));
  const { occupied } = stored.booking;
  const others: readonly PlaceRow[] = await assignmentsOf(scope, tx)
    .where((unit) => unit.resourceId.in(ids))
    .where({ isActive: true })
    .where((unit) => unit.bookingId.neq(stored.booking.id))
    .where((unit) => unit.sessionKey.neq(stored.placement.sessionKey))
    .where((unit) => unit.occupiedStart.lt(toRecordInstant(occupied.end)))
    .where((unit) => unit.occupiedEnd.gt(toRecordInstant(occupied.start)))
    .select('resourceId', 'sessionKey', 'occupiedStart', 'occupiedEnd')
    .all();
  const isFull = units.some((unit) => {
    const bySession = new Map<string, TimeInterval[]>();
    for (const row of others) {
      if (row.resourceId === unit.resourceId) {
        const spans = bySession.get(row.sessionKey) ?? [];
        spans.push({
          start: asInstant(recordMillis(row.occupiedStart)),
          end: asInstant(recordMillis(row.occupiedEnd)),
        });
        bySession.set(row.sessionKey, spans);
      }
    }
    const taken = [...bySession.values()].flatMap((spans) => mergeIntervals(spans));
    const depth = unit.resourceId === null ? 1 : (places.get(unit.resourceId) ?? 1);
    return listOverlaps(intervalsAtDepth(taken, depth), unit.occupied);
  });
  const pooled = new Set(
    [...places].filter(([, count]) => count > 1).map(([resourceId]) => resourceId),
  );
  return { isFull, pooled };
}
