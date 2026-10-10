import { buildCalendarFile } from './calendar-file';

import type { BookingDto } from '../dto/booking-dto';

/** Offers the booking as an `.ics` file download, for the visitor's own calendar. */
export function downloadCalendarFile(booking: BookingDto): void {
  const content = buildCalendarFile(
    {
      uid: booking.reference,
      title: booking.serviceName,
      start: booking.start,
      end: booking.end,
      location: [booking.locationName, booking.locationAddress]
        .filter((part) => part !== null)
        .join(', '),
      description: booking.instructions,
    },
    new Date(),
  );
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${booking.reference}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}
