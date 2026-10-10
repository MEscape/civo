import type { BookableResource } from '../models/bookable-resource';
import type { BookableService } from '../models/bookable-service';
import type { Booking } from '../models/booking';
import type { BookingLocation } from '../models/booking-location';
import type { BookableResourceId, BookingId } from '../models/ids';
import type { LocalDate } from '../time/local-date';
import type { TimeInterval } from '../time/time-interval';

/**
 * Everything the engine needs to answer "is this appointment available":
 * plain data in, a plain answer out. No clock, no storage, no framework.
 */
export interface SchedulingInput {
  readonly service: BookableService;
  readonly location: BookingLocation;
  /** The resources that might serve this location; the engine narrows them by requirement. */
  readonly resources: readonly BookableResource[];
  /** Existing bookings that may overlap the range. Ones that no longer block are ignored. */
  readonly bookings: readonly Booking[];
  /** The moment the question is asked, injected so the answer is repeatable. */
  readonly now: Date;
  /** A booking being moved: it must not block its own new time. */
  readonly ignoreBookingId?: BookingId | undefined;
}

/** A span of local calendar days, both ends included. */
export interface LocalDateRange {
  readonly from: LocalDate;
  readonly to: LocalDate;
}

/**
 * A bookable start time as a visitor sees it. It names no resource: who or
 * what serves the appointment is the engine's business, not the visitor's.
 */
export interface AvailableSlot {
  /** Start of the appointment, epoch milliseconds. */
  readonly start: number;
  /** End of the appointment (not of the clean-up), epoch milliseconds. */
  readonly end: number;
  /** Places left in the session before this booking; 1 for a service that holds its resources alone. */
  readonly remainingParticipants: number;
}

/** A slot together with the assignment that makes it bookable; only the server ever sees this. */
export interface PlannedSlot extends AvailableSlot {
  /** Appointment plus preparation and clean-up: what the resources are held for. */
  readonly occupied: TimeInterval;
  readonly resourceIds: readonly BookableResourceId[];
  /** The key bookings of this session share; `null` when the service holds its resources alone. */
  readonly sharedSessionKey: string | null;
  /** Participants all bookings of the session may add up to. */
  readonly sessionCapacity: number;
  /** Whether it joins a session other bookings already started. */
  readonly joinsExistingSession: boolean;
}

/** Why a start time cannot be booked. */
export type SlotRejection =
  | 'invalid-participants'
  | 'off-grid'
  | 'outside-booking-window'
  | 'location-closed'
  | 'service-unavailable'
  | 'resources-unavailable'
  | 'capacity-exceeded';

export type SlotAssessment =
  | { readonly kind: 'planned'; readonly slot: PlannedSlot }
  | { readonly kind: 'rejected'; readonly reason: SlotRejection };
