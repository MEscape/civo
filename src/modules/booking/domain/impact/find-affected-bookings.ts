import { heldResourceIds, isBlocking, spanOfResource } from '../models/booking';
import { compareIds } from '../models/ids';
import { intervalsAtDepth, listCovers, listOverlaps, mergeIntervals } from '../time/time-interval';

import type { Booking } from '../models/booking';
import type { BookableResourceId, BookingId, BookingLocationId } from '../models/ids';
import type { Instant } from '../time/instant';
import type { TimeInterval } from '../time/time-interval';

/**
 * Time that stops being available, expressed as what REMAINS available afterwards, so the caller
 * does the calendar work once (new weekly hours, a block subtracted) with the same functions that
 * built the old calendar, and this only asks who is left outside.
 */
export type AvailabilityLoss =
  | {
      readonly kind: 'opening-hours';
      readonly locationId: BookingLocationId;
      /** When the location is open for appointments after the change. */
      readonly remaining: readonly TimeInterval[];
    }
  | {
      readonly kind: 'resource';
      readonly resourceId: BookableResourceId;
      /** When the resource may work after the change (hours changed, a block entered). */
      readonly remaining: readonly TimeInterval[];
    }
  | {
      readonly kind: 'places';
      readonly resourceId: BookableResourceId;
      /** How many bookings the resource takes at once after the change. */
      readonly places: number;
    };

export type AffectedReason = 'outside-opening-hours' | 'resource-unavailable' | 'over-capacity';

export interface AffectedBooking {
  readonly bookingId: BookingId;
  readonly reason: AffectedReason;
}

export interface AffectedInput {
  /** The bookings to examine; those that are over or no longer block are skipped. */
  readonly bookings: readonly Booking[];
  readonly loss: AvailabilityLoss;
  readonly now: Instant;
}

function isAffected(
  booking: Booking,
  loss: AvailabilityLoss,
  lost: readonly TimeInterval[],
): AffectedReason | null {
  if (loss.kind === 'places') {
    return heldResourceIds(booking).includes(loss.resourceId) &&
      listOverlaps(lost, spanOfResource(booking, loss.resourceId))
      ? 'over-capacity'
      : null;
  }
  const remaining = lost;
  if (loss.kind === 'opening-hours') {
    return booking.locationId === loss.locationId &&
      !listCovers(remaining, { start: booking.start, end: booking.end })
      ? 'outside-opening-hours'
      : null;
  }
  return heldResourceIds(booking).includes(loss.resourceId) &&
    !listCovers(remaining, spanOfResource(booking, loss.resourceId))
    ? 'resource-unavailable'
    : null;
}

/**
 * The bookings a change of opening hours, of a resource's availability or of its places would leave
 * outside: they are what the manager has to resolve before saving, and what an employee calendar
 * shows as a conflict. The appointment must stay inside the opening hours; the whole occupied span,
 * with its buffers, must stay inside a resource's availability; and where more bookings hold a
 * resource at once than it has places, every one of them is reported (none is more entitled than
 * the others). Only bookings that still matter are examined: ones that block (a confirmed booking,
 * a running hold) and have not ended yet. Earliest first, then by id.
 */
export function findAffectedBookings(input: AffectedInput): AffectedBooking[] {
  const { loss, now } = input;
  const bookings = input.bookings.filter(
    (booking) => isBlocking(booking, now) && booking.end > now,
  );
  // Computed once for all bookings: for places, where the resource is over-full; otherwise what
  // remains, merged, because the lookups below expect a normalized list.
  const lost =
    loss.kind === 'places'
      ? intervalsAtDepth(
          bookings
            .filter((booking) => heldResourceIds(booking).includes(loss.resourceId))
            .map((booking) => spanOfResource(booking, loss.resourceId)),
          loss.places + 1,
        )
      : mergeIntervals(loss.remaining);
  return bookings
    .flatMap((booking) => {
      const reason = isAffected(booking, loss, lost);
      return reason === null ? [] : [{ booking, reason }];
    })
    .sort((a, b) => a.booking.start - b.booking.start || compareIds(a.booking.id, b.booking.id))
    .map(({ booking, reason }) => ({ bookingId: booking.id, reason }));
}
