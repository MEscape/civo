import { isDefined } from '@lib/utils';

import type { ResourceKind } from './bookable-resource';
import type { ChangeActor, InformationField } from './bookable-service';
import type { BookableResourceId, BookableServiceId, BookingId, BookingLocationId } from './ids';
import type { Instant } from '../time/instant';
import type { TimeInterval } from '../time/time-interval';

/**
 * Where a booking is in its life. The list is the database enum `BookingStatus`.
 *
 * - `held`: the slot is reserved for a visitor who is still filling in the form; it expires.
 * - `confirmed`: the booking stands.
 * - `cancelled`, `completed`, `no_show`: it ended; the slot is no longer occupied.
 * - `expired`: a hold that was not confirmed in time.
 *
 * "Open", "assigned" and "conflict" are NOT statuses (BD-04): whether the employees are assigned is
 * read from the booking's assignments, and a conflict is computed (`find-affected-bookings.ts`), so
 * it cannot go stale.
 */
export const BOOKING_STATUSES = [
  'held',
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
  'expired',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** What the visitor entered; a field a service did not ask for is simply absent. */
export type BookingCustomer = Readonly<Partial<Record<InformationField, string>>>;

/**
 * One unit of one requirement of the service, and who serves it. `resourceId` is `null` only for
 * an employee that is not assigned yet (an open or manually assigned booking); a room or a desk is
 * always held.
 */
export interface Assignment {
  /** The position of the requirement in the service's `requirements`. */
  readonly requirementIndex: number;
  readonly resourceType: ResourceKind;
  readonly resourceId: BookableResourceId | null;
  /** What this unit is held for: the appointment plus its own margins (`occupancyOf`). */
  readonly occupied: TimeInterval;
}

/**
 * A reserved span of time and who serves it, as the rules see it. Identifiers a visitor quotes (a
 * reference), the group size, shared sessions and the tenant belong to later steps.
 *
 * `start` and `end` are the appointment the visitor sees; `occupied` covers the appointment and
 * every unit's own span (the hull) and is what a list of bookings is searched by. What a single
 * resource is held for is its unit's `occupied`, and that is what conflicts are checked against.
 */
export interface Booking {
  readonly id: BookingId;
  readonly serviceId: BookableServiceId;
  readonly locationId: BookingLocationId;
  readonly status: BookingStatus;
  readonly start: Instant;
  readonly end: Instant;
  readonly occupied: TimeInterval;
  readonly assignments: readonly Assignment[];
  /** `null` while held: the details are entered after the slot is reserved. */
  readonly customer: BookingCustomer | null;
  /** Set while `held`; after this instant the hold no longer blocks anything. */
  readonly holdExpiresAt: Instant | null;
  /** How often the customer moved it; moves by staff do not count against the customer's limit. */
  readonly rescheduleCount: number;
  readonly cancelledAt: Instant | null;
  readonly cancelledBy: ChangeActor | null;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

/**
 * The statuses in which a booking can occupy its resources (a hold only until it runs out, see
 * `isBlocking`). The rows that carry the database's double-booking constraint are live exactly
 * then.
 */
export function isLiveStatus(status: BookingStatus): boolean {
  return status === 'held' || status === 'confirmed';
}

/**
 * Whether a booking currently occupies its resources. A hold's expiry is judged by the clock
 * passed in, not by the stored status, so an expired hold stops blocking the moment it expires,
 * whether or not anything has marked it `expired`. A cancelled, completed, no-show or expired
 * booking never blocks.
 */
export function isBlocking(booking: Booking, now: Instant): boolean {
  if (booking.status === 'confirmed') {
    return true;
  }
  return booking.status === 'held' && booking.holdExpiresAt !== null && booking.holdExpiresAt > now;
}

/** The resources the booking holds right now: every unit that is assigned. */
export function heldResourceIds(booking: Booking): BookableResourceId[] {
  return booking.assignments.map((unit) => unit.resourceId).filter(isDefined);
}

/** The booking with `changes` applied and `updatedAt` set to the instant of the change. */
export function updatedBooking(booking: Booking, now: Instant, changes: Partial<Booking>): Booking {
  return { ...booking, ...changes, updatedAt: now };
}

/**
 * What the units of one requirement are held for (all of them the same kind of resource, so the
 * same span). A booking without such a unit is held for its whole span.
 */
export function spanOfRequirement(booking: Booking, requirementIndex: number): TimeInterval {
  return (
    booking.assignments.find((unit) => unit.requirementIndex === requirementIndex)?.occupied ??
    booking.occupied
  );
}

/** What one resource is held for on this booking, or the whole span when it is not on it. */
export function spanOfResource(booking: Booking, resourceId: BookableResourceId): TimeInterval {
  return (
    booking.assignments.find((unit) => unit.resourceId === resourceId)?.occupied ?? booking.occupied
  );
}

/** Whether some unit still waits for an employee. */
export function hasOpenUnits(booking: Booking): boolean {
  return booking.assignments.some((unit) => unit.resourceId === null);
}
