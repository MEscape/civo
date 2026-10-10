import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { formatLocalDate } from '../../domain/time/local-date';
import { formatTimeOfDay } from '../../domain/time/time-of-day';
import { epochToZonedWallClock } from '../../domain/time/time-zone';

import type { BookingParts } from './own-booking';
import type {
  BookingNotice,
  BookingNoticeKind,
  BookingNotifier,
} from '../../domain/ports/booking-notifier.port';

/**
 * Tells the person who booked what happened to their booking. A held booking
 * has no address yet, so there is nobody to tell. Never fails: see
 * `BookingNotifier`.
 */
export function notifyCustomer(
  notifier: BookingNotifier,
  kind: BookingNoticeKind,
  { booking, service, location }: BookingParts,
): AppResultAsync<void, never> {
  if (booking.customer === null) {
    return okAsync(undefined);
  }
  const wallClock = epochToZonedWallClock(booking.start.getTime(), location.timeZone);
  return notifier.notify({
    kind,
    to: booking.customer.email,
    reference: booking.reference,
    serviceName: service.name,
    locationName: location.name,
    locationAddress: location.address,
    localDate: formatLocalDate(wallClock.date),
    localTime: formatTimeOfDay(wallClock.minuteOfDay),
    timeZone: location.timeZone,
    participants: booking.participants,
    requiredDocuments: service.requiredDocuments,
    instructions: service.instructions,
  } satisfies BookingNotice);
}
