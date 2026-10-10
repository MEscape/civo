'use client';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { INFORMATION_FIELD_MESSAGE_KEYS } from '../../messages/message-keys';

import { BookingSummary } from './booking-summary';

import type { HoldDto } from '../../dto/booking-dto';
import type { PublicServiceDto } from '../../dto/catalog-dto';

export interface ReviewStepProps {
  readonly service: PublicServiceDto;
  readonly hold: HoldDto;
  readonly values: Readonly<Record<string, string>>;
  readonly locationAddress: string | null;
  readonly isPending: boolean;
  readonly readOnly: boolean;
  readonly onBack: () => void;
  readonly onConfirm: () => void;
}

/** The last look before committing: what, when, where, and the details as entered. */
export function ReviewStep({
  service,
  hold,
  values,
  locationAddress,
  isPending,
  readOnly,
  onBack,
  onConfirm,
}: ReviewStepProps) {
  const t = useTranslations('booking');

  return (
    <div className="space-y-6">
      <BookingSummary
        serviceName={hold.serviceName}
        locationName={hold.locationName}
        locationAddress={locationAddress}
        timeZone={hold.timeZone}
        localDate={hold.localDate}
        localTime={hold.localTime}
        participants={hold.participants}
        showParticipants={service.maxParticipantsPerBooking > 1}
      />

      <section aria-labelledby="review-details" className="space-y-2">
        <h4 id="review-details" className="text-sm font-medium text-copy">
          {t('review.yourDetails')}
        </h4>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          {service.information.map(({ field }) => {
            const value = values[field]?.trim() ?? '';
            return (
              <div key={field} className="contents">
                <dt className="text-copy-muted">{t(INFORMATION_FIELD_MESSAGE_KEYS[field])}</dt>
                <dd className="whitespace-pre-line break-words text-copy">
                  {value === '' ? t('review.notProvided') : value}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <p className="text-sm text-copy-muted">{t('review.privacy')}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" onClick={onBack} disabled={isPending}>
          {t('actions.back')}
        </Button>
        <Button type="button" onClick={onConfirm} disabled={isPending || readOnly}>
          {isPending ? t('review.confirming') : t('review.confirm')}
        </Button>
        {readOnly && <p className="text-xs text-copy-muted">{t('preview.disabled')}</p>}
      </div>
    </div>
  );
}
