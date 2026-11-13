import { parseBookingLocationId } from '../../domain/models/ids';
import { formatLocalDate, parseLocalDate } from '../../domain/time/local-date';
import { MINUTES_PER_DAY } from '../../domain/time/time-of-day';
import { wallClockOf } from '../../domain/time/time-zone';

import type { Booking } from '../../domain/models/booking';
import type { BookingLocationId } from '../../domain/models/ids';
import type { LocalDate } from '../../domain/time/local-date';
import type { TimeZone } from '../../domain/time/time-zone';
import type { GetOpenBookingsInput, PartOfDay } from '../contracts/employee-inputs';

/** What narrows the open bookings, read: absent fields narrow nothing. */
export interface OpenFilter {
  readonly date: LocalDate | undefined;
  readonly locationId: BookingLocationId | undefined;
  readonly partOfDay: PartOfDay | undefined;
}

const MIDDAY = MINUTES_PER_DAY / 2;

/** The filters as the rules read them; `null` when the date or the location is not one. */
export function parseOpenFilter(input: GetOpenBookingsInput): OpenFilter | null {
  const date = input.date === undefined ? undefined : parseLocalDate(input.date);
  const locationId =
    input.locationId === undefined ? undefined : parseBookingLocationId(input.locationId);
  if (date === null || locationId?.isErr() === true) {
    return null;
  }
  return { date, locationId: locationId?.unwrapOr(undefined), partOfDay: input.partOfDay };
}

/**
 * Whether a booking starts on the filter's day and in its part of the day, both on the clock of the
 * booking's own location (a morning is a morning where the citizen is).
 */
export function isOnDay(booking: Booking, zone: TimeZone, filter: OpenFilter): boolean {
  const start = wallClockOf(booking.start, zone);
  const isDay =
    filter.date === undefined || formatLocalDate(start.date) === formatLocalDate(filter.date);
  const isPart =
    filter.partOfDay === undefined ||
    (filter.partOfDay === 'morning') === start.minuteOfDay < MIDDAY;
  return isDay && isPart;
}
