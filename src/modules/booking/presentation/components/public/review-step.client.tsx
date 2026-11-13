'use client';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { DetailFact } from '../shared/detail-fact';

import { BookingSummary } from './booking-summary';
import { ChangeRules } from './change-rules';

import type { PublicBookingDto } from '../../dto/booking-dto';
import type { CatalogServiceDto } from '../../dto/catalog-dto';
import type { JourneyDetails } from '../../forms/journey-state';

export interface ReviewStepProps {
  readonly hold: PublicBookingDto;
  readonly service: CatalogServiceDto;
  readonly details: JourneyDetails;
  readonly isPending: boolean;
  readonly onConfirm: () => void;
}

/**
 * Everything the booking will be, before it is made: the reserved time, what the visitor typed,
 * what they may change later. One press books; while it runs, the button cannot be pressed again.
 */
export function ReviewStep({ hold, service, details, isPending, onConfirm }: ReviewStepProps) {
  const t = useTranslations('booking');

  return (
    <div className="space-y-5">
      <p className="text-base text-copy-muted">{t('public.held')}</p>
      <BookingSummary booking={hold} showReference={false}>
        {service.information
          .filter(({ field }) => (details[field] ?? '') !== '')
          .map(({ field }) => (
            <DetailFact key={field} size="comfortable" label={t(`public.fields.${field}`)}>
              {details[field]}
            </DetailFact>
          ))}
      </BookingSummary>
      {service.requiredDocuments.length > 0 && (
        <p className="text-base text-copy">
          {t('public.documents', { documents: service.requiredDocuments.join(', ') })}
        </p>
      )}
      <ChangeRules booking={hold} />
      <Button
        type="button"
        size="lg"
        className="min-h-11"
        aria-disabled={isPending}
        aria-busy={isPending}
        onClick={() => {
          if (!isPending) {
            onConfirm();
          }
        }}
      >
        {isPending ? t('public.confirming') : t('public.confirm')}
      </Button>
    </div>
  );
}
