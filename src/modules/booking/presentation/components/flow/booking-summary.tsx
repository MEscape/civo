import { useTranslations } from '@i18n/client';

import { useZonedFormat } from '../../hooks/use-zoned-format';

export interface BookingSummaryProps {
  readonly serviceName: string;
  readonly locationName: string;
  readonly locationAddress: string | null;
  readonly timeZone: string;
  readonly localDate: string;
  readonly localTime: string;
  readonly participants: number;
  /** Shown only when the service lets people book for a group. */
  readonly showParticipants: boolean;
}

/** What is being booked, as a description list: the same wording on the review and the confirmation. */
export function BookingSummary({
  serviceName,
  locationName,
  locationAddress,
  timeZone,
  localDate,
  localTime,
  participants,
  showParticipants,
}: BookingSummaryProps) {
  const t = useTranslations('booking');
  const format = useZonedFormat(timeZone);

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
      <dt className="text-copy-muted">{t('summary.service')}</dt>
      <dd className="text-copy">{serviceName}</dd>
      <dt className="text-copy-muted">{t('summary.when')}</dt>
      <dd className="text-copy">
        {format.longDate(localDate)}
        {', '}
        {format.timeOfDay(localTime)}
      </dd>
      <dt className="text-copy-muted">{t('summary.where')}</dt>
      <dd className="text-copy">
        {locationName}
        {locationAddress !== null && (
          <span className="block text-copy-muted">{locationAddress}</span>
        )}
      </dd>
      {showParticipants && (
        <>
          <dt className="text-copy-muted">{t('summary.participants')}</dt>
          <dd className="text-copy">{participants}</dd>
        </>
      )}
    </dl>
  );
}
