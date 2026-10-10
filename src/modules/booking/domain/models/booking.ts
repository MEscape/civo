import type { TenantId } from '@modules/auth';

import type { ChangeActor } from './bookable-service';
import type { BookingCustomer } from './booking-customer';
import type { BookingReference } from './booking-reference';
import type {
  BookableResourceId,
  BookableServiceId,
  BookingId,
  BookingLocationId,
  WebsiteId,
} from './ids';

/**
 * Where a booking is in its life.
 *
 * - `held`: the slot is reserved for a visitor who is still filling in the form; it expires.
 * - `confirmed`: the booking stands.
 * - `cancelled`, `completed`, `no_show`: it ended; the slot is no longer occupied.
 * - `expired`: a hold that was not confirmed in time.
 *
 * "Draft" is not a state: a form in progress lives in the visitor's browser
 * and reserves nothing. "Rescheduled" is not a state either: it is an event
 * on a confirmed booking, counted in `rescheduleCount`.
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

export function isBookingStatus(raw: string): raw is BookingStatus {
  return BOOKING_STATUSES.some((status) => status === raw);
}

/**
 * A reserved span of time on a set of resources.
 *
 * `start`/`end` are the appointment the visitor sees. `occupiedStart` and
 * `occupiedEnd` include the service's preparation and clean-up, and are what
 * conflicts are checked against. All four are UTC instants; the wall-clock
 * time shown to people is derived from the location's zone, never stored.
 *
 * `sessionKey` groups bookings that share resources: it is unique per booking
 * for a service that holds its resources alone, and common to all bookings of
 * one start for a service that sells several places in the same session.
 */
export interface Booking {
  readonly id: BookingId;
  readonly tenantId: TenantId;
  readonly websiteId: WebsiteId;
  readonly serviceId: BookableServiceId;
  readonly locationId: BookingLocationId;
  readonly reference: BookingReference;
  readonly status: BookingStatus;
  readonly start: Date;
  readonly end: Date;
  readonly occupiedStart: Date;
  readonly occupiedEnd: Date;
  readonly participants: number;
  readonly resourceIds: readonly BookableResourceId[];
  readonly sessionKey: string;
  /** The most participants the session this booking belongs to may hold. */
  readonly sessionCapacity: number;
  /** `null` while held: the details are entered after the slot is reserved. */
  readonly customer: BookingCustomer | null;
  /** Set while `held`; after this instant the hold no longer blocks anything. */
  readonly holdExpiresAt: Date | null;
  readonly rescheduleCount: number;
  readonly cancelledAt: Date | null;
  readonly cancelledBy: ChangeActor | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Whether a booking currently occupies its resources. Expiry is judged by the
 * clock passed in, not by the stored status, so an expired hold stops
 * blocking the moment it expires, whether or not anything has tidied it up.
 */
export function isBlocking(booking: Booking, now: Date): boolean {
  if (booking.status === 'confirmed') {
    return true;
  }
  return (
    booking.status === 'held' &&
    booking.holdExpiresAt !== null &&
    booking.holdExpiresAt.getTime() > now.getTime()
  );
}

/**
 * The key bookings share when they share a session; `null` for a service that
 * sells one place per session, where nothing is ever shared. A service that
 * sells several keys all bookings of one start at one location together, so
 * they hold the same resources and fill the same session.
 */
export function sharedSessionKey(parts: {
  readonly serviceId: BookableServiceId;
  readonly locationId: BookingLocationId;
  /** Start of the appointment, epoch milliseconds. */
  readonly start: number;
  readonly participantsPerSession: number;
}): string | null {
  return parts.participantsPerSession > 1
    ? `session:${parts.serviceId}:${parts.locationId}:${parts.start}`
    : null;
}

/** The key stored on a booking: the shared session's, or its own reference when it shares nothing. */
export function bookingSessionKey(shared: string | null, reference: BookingReference): string {
  return shared ?? `booking:${reference}`;
}
