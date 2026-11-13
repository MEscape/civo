'use client';

import { useTranslations } from '@i18n/client';

import { nameBookOf, unitLinesOf } from '../forms/booking-names';

import { useZonedFormat } from './use-zoned-format';

import type { BookingDetailDto, BookingNamesDto } from '../dto/booking-dto';

/**
 * What the details of a booking say about it, worked out from the names the page knows: the service,
 * when and where on the location's clock, and the places it holds, split into the people who serve it
 * and the rooms and devices.
 */
export function useBookingPanelFacts(booking: BookingDetailDto, names: BookingNamesDto) {
  const t = useTranslations('booking');
  const format = useZonedFormat();
  const book = nameBookOf(names, t('bookings.list.unknown'));
  const units = unitLinesOf(booking, book);
  return {
    book,
    service: book.service(booking.serviceId),
    subtitle: [
      format.date(booking.start, booking.timeZone),
      format.timeRange(booking.start, booking.end, booking.timeZone),
      book.location(booking.locationId),
    ].join(' · '),
    employees: units.filter((unit) => unit.isEmployee),
    resources: units.filter((unit) => !unit.isEmployee),
  };
}
