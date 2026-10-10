import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import type { BookingDto } from '../../dto/booking-dto';

export interface OwnBookingActionsProps {
  readonly booking: BookingDto;
  readonly isPending: boolean;
  /** The editor canvas: nothing may be changed. */
  readonly readOnly: boolean;
  readonly onReschedule: () => void;
  readonly onCancel: () => void;
}

/** Move or cancel, as far as the service's rules still allow; says so when they no longer do. */
export function OwnBookingActions({
  booking,
  isPending,
  readOnly,
  onReschedule,
  onCancel,
}: OwnBookingActionsProps) {
  const t = useTranslations('booking');

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!booking.canReschedule || isPending || readOnly}
          onClick={onReschedule}
        >
          {t('manage.reschedule')}
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={!booking.canCancel || isPending || readOnly}
          onClick={onCancel}
        >
          {t('manage.cancel')}
        </Button>
      </div>
      {(!booking.canReschedule || !booking.canCancel) && (
        <p className="text-sm text-copy-muted">{t('manage.limited')}</p>
      )}
    </div>
  );
}
