'use client';

import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useManagedBooking } from '../../hooks/use-managed-booking';
import { STATUS_MESSAGE_KEYS } from '../../messages/message-keys';
import { CancelConfirmation } from '../shared/cancel-confirmation';
import { ErrorNotice } from '../shared/error-notice';
import { RescheduleSection } from '../shared/reschedule-section';

import { BookingLookupForm } from './booking-lookup-form';
import { BookingSummary } from './booking-summary';
import { OwnBookingActions } from './own-booking-actions';

import type { BookingDto } from '../../dto/booking-dto';
import type { PublicServiceDto } from '../../dto/catalog-dto';

export interface ManageBookingProps {
  readonly websiteId: string;
  readonly services: readonly PublicServiceDto[];
  /** A booking the visitor just made: they are not asked to look it up again. */
  readonly initial: { readonly booking: BookingDto; readonly email: string } | null;
  readonly readOnly: boolean;
  readonly onBack: () => void;
}

const STATUS_VARIANT = {
  held: 'info',
  confirmed: 'success',
  cancelled: 'muted',
  completed: 'muted',
  no_show: 'warning',
  expired: 'muted',
} as const;

/** Used when the service is no longer in the catalog: the server still enforces the real horizon. */
const FALLBACK_HORIZON_DAYS = 365;

function allowsGroups(service: PublicServiceDto | undefined): boolean {
  return service !== undefined && service.maxParticipantsPerBooking > 1;
}

function horizonOf(service: PublicServiceDto | undefined): number {
  return service?.horizonDays ?? FALLBACK_HORIZON_DAYS;
}

/**
 * "My booking": the visitor proves ownership with the reference AND the
 * e-mail address, then can cancel or move the booking within the service's
 * rules. A wrong address looks exactly like an unknown reference.
 */
export function ManageBooking({
  websiteId,
  services,
  initial,
  readOnly,
  onBack,
}: ManageBookingProps) {
  const t = useTranslations('booking');
  const managed = useManagedBooking(websiteId, initial);
  const { booking, mode, slot, errorCode, isPending } = managed;

  if (booking === null) {
    return (
      <BookingLookupForm
        errorCode={errorCode}
        isPending={isPending}
        onFind={managed.lookUp}
        onBack={onBack}
      />
    );
  }

  const service = services.find((candidate) => candidate.id === booking.serviceId);
  const isLive = booking.status === 'confirmed';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-mono text-lg font-semibold tracking-wider text-copy">
          {booking.reference}
        </p>
        <Badge variant={STATUS_VARIANT[booking.status]}>
          {t(STATUS_MESSAGE_KEYS[booking.status])}
        </Badge>
      </div>

      <BookingSummary
        serviceName={booking.serviceName}
        locationName={booking.locationName}
        locationAddress={booking.locationAddress}
        timeZone={booking.timeZone}
        localDate={booking.localDate}
        localTime={booking.localTime}
        participants={booking.participants}
        showParticipants={allowsGroups(service)}
      />

      {errorCode !== null && <ErrorNotice code={errorCode} focus />}

      {isLive && mode === 'view' && (
        <OwnBookingActions
          booking={booking}
          isPending={isPending}
          readOnly={readOnly}
          onReschedule={() => {
            managed.goTo('reschedule');
          }}
          onCancel={() => {
            managed.goTo('confirm-cancel');
          }}
        />
      )}

      {!isLive && (
        <p className="text-sm text-copy-muted" role="status">
          {t('manage.notActive')}
        </p>
      )}

      {mode === 'confirm-cancel' && (
        <CancelConfirmation
          message={t('manage.confirmCancel')}
          confirmLabel={isPending ? t('manage.cancelling') : t('manage.confirmCancelYes')}
          keepLabel={t('manage.keep')}
          isPending={isPending}
          onConfirm={managed.cancel}
          onKeep={() => {
            managed.goTo('view');
          }}
        />
      )}

      {mode === 'reschedule' && (
        <section className="space-y-4" aria-label={t('manage.rescheduleTitle')}>
          <h4 className="text-base font-medium text-copy">{t('manage.rescheduleTitle')}</h4>
          <RescheduleSection
            websiteId={websiteId}
            serviceId={booking.serviceId}
            locationId={booking.locationId}
            participants={booking.participants}
            horizonDays={horizonOf(service)}
            slot={slot}
            timeZone={booking.timeZone}
            isPending={isPending}
            keepLabel={t('manage.keep')}
            onSelect={managed.setSlot}
            onConfirm={managed.move}
            onKeep={() => {
              managed.goTo('view');
            }}
          />
        </section>
      )}

      <Button type="button" variant="link" onClick={onBack}>
        {t('manage.backToBooking')}
      </Button>
    </div>
  );
}
