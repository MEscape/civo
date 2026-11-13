import type { ReactNode } from 'react';

import { CopyButton } from '@components/shared/page-parts.client';

import { useTranslations } from '@i18n/client';

import { isDefined } from '@lib/utils';

import { useZonedFormat } from '../../hooks/use-zoned-format';
import { STATUS_MESSAGE_KEYS } from '../../messages/message-keys';
import { DetailFact } from '../shared/detail-fact';

import type { PublicBookingDto } from '../../dto/booking-dto';

export interface BookingSummaryProps {
  readonly booking: PublicBookingDto;
  /** A reservation has a number already, but it is not the visitor's to keep until it is booked. */
  readonly showReference: boolean;
  readonly children?: ReactNode;
}

/**
 * A visitor's booking in one block, the same on the review, the confirmation and "my booking":
 * the service, the time on the location's clock with its zone named, the place and the number.
 * The number can be copied: it is the one thing the visitor must keep.
 */
export function BookingSummary({ booking, showReference, children }: BookingSummaryProps) {
  const t = useTranslations('booking');
  const zoned = useZonedFormat();
  const { timeZone } = booking;

  return (
    <dl
      aria-label={t('public.summary.label')}
      className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-x-6 gap-y-4"
    >
      <DetailFact size="comfortable" label={t('public.summary.service')}>
        {booking.serviceName}
      </DetailFact>
      <DetailFact size="comfortable" label={t('public.summary.when')}>
        {`${zoned.longDate(booking.start, timeZone)}, ${zoned.timeRange(booking.start, booking.end, timeZone)} `}
        <span className="text-copy-muted">({t('public.summary.zone', { zone: timeZone })})</span>
      </DetailFact>
      <DetailFact size="comfortable" label={t('public.summary.where')}>
        {[booking.locationName, booking.locationAddress].filter(isDefined).join(', ')}
      </DetailFact>
      {showReference && (
        <DetailFact size="comfortable" label={t('public.summary.reference')}>
          <span className="inline-flex items-center gap-1">
            <span className="font-mono text-lg font-semibold tracking-wider">
              {booking.reference}
            </span>
            <CopyButton
              value={booking.reference}
              label={t('public.summary.copyReference')}
              copiedLabel={t('public.summary.copied')}
            />
          </span>
        </DetailFact>
      )}
      {booking.status !== 'held' && booking.status !== 'confirmed' && (
        <DetailFact size="comfortable" label={t('public.summary.status')}>
          {t(STATUS_MESSAGE_KEYS[booking.status])}
        </DetailFact>
      )}
      {children}
    </dl>
  );
}
