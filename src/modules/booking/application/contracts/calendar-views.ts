import type { ChangeActor } from '../../domain/models/bookable-service';
import type { BookingStatus } from '../../domain/models/booking';

/** What staff see on the operations calendar. */

/** One booking on the operations calendar. Staff see more than the visitor: who holds it, and its resources. */
export interface CalendarBookingView {
  readonly id: string;
  readonly reference: string;
  readonly status: BookingStatus;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly locationId: string;
  readonly resourceIds: readonly string[];
  readonly start: Date;
  readonly end: Date;
  readonly occupiedStart: Date;
  readonly occupiedEnd: Date;
  readonly participants: number;
  readonly customerName: string | null;
  readonly customerEmail: string | null;
  readonly customerPhone: string | null;
  readonly notes: string | null;
  readonly cancelledBy: ChangeActor | null;
  readonly rescheduleCount: number;
}

export interface CalendarResourceView {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly locationId: string | null;
}

export interface OperationsCalendarView {
  readonly timeZone: string;
  readonly from: string;
  readonly to: string;
  readonly bookings: readonly CalendarBookingView[];
  /** The range holds more bookings than are shown. */
  readonly isTruncated: boolean;
  readonly resources: readonly CalendarResourceView[];
}

/** One of the next appointments on the website overview. */
export interface UpcomingBookingView {
  readonly id: string;
  readonly start: Date;
  readonly end: Date;
  readonly serviceName: string;
  readonly customerName: string | null;
}

/** What the website overview shows of the bookings. */
export interface BookingSummaryView {
  /** `false` until a location exists: there is no calendar to count in. */
  readonly hasLocation: boolean;
  /** Appointments today in the first location's calendar. */
  readonly today: number;
  /** Appointments still to come within the next `days` days, today included. */
  readonly upcoming: number;
  readonly days: number;
  /** The next few, soonest first. */
  readonly next: readonly UpcomingBookingView[];
}
