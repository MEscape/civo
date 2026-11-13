import { useTranslations } from '@i18n/client';

import { isDefined } from '@lib/utils';

import { DetailFact } from '../shared/detail-fact';

import type { BookingJourney } from '../../hooks/use-booking-journey';

export interface JourneyChoicesProps {
  readonly service: BookingJourney['service'];
  readonly location: BookingJourney['location'];
}

/**
 * What the visitor is booking and where, kept in view while they pick a day, a time and fill in
 * their details: a page may fix the service, and a service with one place picks it, so neither
 * was necessarily a question they answered.
 */
export function JourneyChoices({ service, location }: JourneyChoicesProps) {
  const t = useTranslations('booking');
  if (service === null && location === null) {
    return null;
  }

  return (
    <dl
      aria-label={t('public.summary.label')}
      className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-x-6 gap-y-3 rounded-token border border-border bg-surface p-4"
    >
      {service !== null && (
        <DetailFact size="comfortable" label={t('public.summary.service')}>
          {service.name}
        </DetailFact>
      )}
      {location !== null && (
        <DetailFact size="comfortable" label={t('public.summary.where')}>
          {[location.name, location.address].filter(isDefined).join(', ')}
        </DetailFact>
      )}
    </dl>
  );
}
