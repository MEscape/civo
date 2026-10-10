import { toWallClock } from '../time/zoned-time';

import type { BookingStatus, ChangeActor } from '../../application/contracts/booking-constraints';
import type {
  CalendarBookingView,
  CalendarResourceView,
  OperationsCalendarView,
} from '../../application/contracts/calendar-views';

export interface CalendarBookingDto {
  readonly id: string;
  readonly reference: string;
  readonly status: BookingStatus;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly locationId: string;
  readonly resourceIds: readonly string[];
  readonly start: string;
  readonly end: string;
  /** Wall-clock `YYYY-MM-DDTHH:mm:00` in the calendar's zone, for the calendar widget. */
  readonly startLocal: string;
  readonly endLocal: string;
  readonly participants: number;
  readonly customerName: string | null;
  readonly customerEmail: string | null;
  readonly customerPhone: string | null;
  readonly notes: string | null;
  readonly cancelledBy: ChangeActor | null;
  readonly rescheduleCount: number;
}

export interface OperationsCalendarDto {
  readonly timeZone: string;
  readonly from: string;
  readonly to: string;
  readonly bookings: readonly CalendarBookingDto[];
  readonly resources: readonly CalendarResourceView[];
}

function localStamp(instant: Date, timeZone: string): string {
  const { date, time } = toWallClock(instant, timeZone);
  return `${date}T${time}:00`;
}

export function toCalendarBookingDto(
  booking: CalendarBookingView,
  timeZone: string,
): CalendarBookingDto {
  return {
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    serviceId: booking.serviceId,
    serviceName: booking.serviceName,
    locationId: booking.locationId,
    resourceIds: booking.resourceIds,
    start: booking.start.toISOString(),
    end: booking.end.toISOString(),
    startLocal: localStamp(booking.start, timeZone),
    endLocal: localStamp(booking.end, timeZone),
    participants: booking.participants,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    notes: booking.notes,
    cancelledBy: booking.cancelledBy,
    rescheduleCount: booking.rescheduleCount,
  };
}

export function toOperationsCalendarDto(view: OperationsCalendarView): OperationsCalendarDto {
  return {
    timeZone: view.timeZone,
    from: view.from,
    to: view.to,
    bookings: view.bookings.map((booking) => toCalendarBookingDto(booking, view.timeZone)),
    resources: view.resources.map(({ id, name, type, locationId }) => ({
      id,
      name,
      type,
      locationId,
    })),
  };
}

/** What a staff action reports back: which booking changed and where it ended up. The calendar reloads its range for the rest. */
export interface StaffChangeDto {
  readonly bookingId: string;
  readonly status: BookingStatus;
}

export function toStaffChangeDto(booking: CalendarBookingView): StaffChangeDto {
  return { bookingId: booking.id, status: booking.status };
}
