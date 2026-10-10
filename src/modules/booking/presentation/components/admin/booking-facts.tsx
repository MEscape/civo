import type { ReactNode } from 'react';

import { useTranslations } from '@i18n/client';

import { useZonedFormat } from '../../hooks/use-zoned-format';

import type { CalendarBookingDto } from '../../dto/calendar-dto';

interface FactProps {
  readonly label: string;
  readonly className?: string;
  readonly children: ReactNode;
}

function Fact({ label, className = '', children }: FactProps) {
  return (
    <>
      <dt className="text-copy-muted">{label}</dt>
      <dd className={`text-copy ${className}`.trim()}>{children}</dd>
    </>
  );
}

export interface BookingFactsProps {
  readonly booking: CalendarBookingDto;
  readonly resourceNames: readonly string[];
  readonly timeZone: string;
}

/** What is known about one booking, as a definition list. Rows without a value are left out. */
export function BookingFacts({ booking, resourceNames, timeZone }: BookingFactsProps) {
  const t = useTranslations('booking');
  const format = useZonedFormat(timeZone);
  const notProvided = t('review.notProvided');

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
      <Fact label={t('summary.when')}>{format.dateTime(booking.start)}</Fact>
      <Fact label={t('summary.participants')}>{booking.participants}</Fact>
      {resourceNames.length > 0 && (
        <Fact label={t('details.resources')}>{resourceNames.join(', ')}</Fact>
      )}
      <Fact label={t('details.customer')}>{booking.customerName ?? notProvided}</Fact>
      <Fact label={t('fields.email')} className="break-all">
        {booking.customerEmail ?? notProvided}
      </Fact>
      {booking.customerPhone !== null && (
        <Fact label={t('fields.phone')}>{booking.customerPhone}</Fact>
      )}
      {booking.notes !== null && (
        <Fact label={t('fields.notes')} className="whitespace-pre-line break-words">
          {booking.notes}
        </Fact>
      )}
      {booking.rescheduleCount > 0 && (
        <Fact label={t('details.rescheduled')}>{booking.rescheduleCount}</Fact>
      )}
      {booking.cancelledBy !== null && (
        <Fact label={t('details.cancelledBy')}>{t(`actors.${booking.cancelledBy}`)}</Fact>
      )}
    </dl>
  );
}
