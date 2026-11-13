'use client';

import { ConfirmDialog } from '@components/shared/dialog';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { customerNameOf, staffNamesOf } from '../../forms/booking-names';
import { useZonedFormat } from '../../hooks/use-zoned-format';
import { BookingStatusChip } from '../shared/booking-status-chip';

import type { BookingDto } from '../../dto/booking-dto';
import type { NameBook } from '../../forms/booking-names';

export interface CalendarEventDetailsProps {
  readonly booking: BookingDto;
  readonly book: NameBook;
  readonly isOpen: boolean;
  /** The list on the booking's day with its details. */
  readonly detailsHref: string;
  /** "Mitarbeiter zuweisen" leads somewhere: a manager, and an employee unit still open. */
  readonly mayAssign: boolean;
  readonly onAssign: () => void;
  readonly onClose: () => void;
}

/** What a calendar entry opens (mockup 07): the booking in short, and the way to assign or to its details. */
export function CalendarEventDetails({
  booking,
  book,
  isOpen,
  detailsHref,
  mayAssign,
  onAssign,
  onClose,
}: CalendarEventDetailsProps) {
  const t = useTranslations('booking');
  const format = useZonedFormat();
  const customer = customerNameOf(booking.customer);
  const staff = staffNamesOf(booking, book);

  return (
    <ConfirmDialog
      open={isOpen}
      confirmVariant="default"
      title={book.service(booking.serviceId)}
      description={[
        format.date(booking.start, booking.timeZone),
        format.timeRange(booking.start, booking.end, booking.timeZone),
        book.location(booking.locationId),
      ].join(' · ')}
      confirmLabel={t('bookings.actions.assign')}
      cancelLabel={t('calendar.popover.close')}
      isConfirmDisabled={!mayAssign}
      onConfirm={onAssign}
      onCancel={onClose}
    >
      <div className="space-y-2 text-sm">
        <BookingStatusChip status={booking.status} assignment={booking.assignment} />
        {customer !== null && <p>{t('calendar.popover.customer', { name: customer })}</p>}
        {staff.length > 0 && <p>{t('calendar.popover.staff', { names: staff.join(', ') })}</p>}
        <Link href={detailsHref} className="text-primary-copy underline underline-offset-2">
          {t('calendar.popover.details')}
        </Link>
      </div>
    </ConfirmDialog>
  );
}
