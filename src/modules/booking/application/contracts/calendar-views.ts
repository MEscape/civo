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
  readonly resources: readonly CalendarResourceView[];
}
