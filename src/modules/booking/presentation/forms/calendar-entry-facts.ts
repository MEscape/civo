import { MS_PER_MINUTE } from '@lib/utils';

import { staffNamesOf } from './booking-names';

import type { NameBook } from './booking-names';
import type { BookingDto } from '../dto/booking-dto';

/** What a calendar entry says about a booking, from the names the page knows: the service, where and with whom, and how long it is. */
export function calendarEntryFacts(booking: BookingDto, book: NameBook) {
  return {
    service: book.service(booking.serviceId),
    place: [book.location(booking.locationId), ...staffNamesOf(booking, book)].join(' · '),
    minutes: (Date.parse(booking.end) - Date.parse(booking.start)) / MS_PER_MINUTE,
    state: booking.status === 'confirmed' ? booking.assignment : booking.status,
  };
}
