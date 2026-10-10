import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import type { ActionResult } from '@lib/result';

import { completeBookingAction } from '../../actions/complete-booking-action';
import { markBookingNoShowAction } from '../../actions/mark-booking-no-show-action';

import type { CalendarBookingDto } from '../../dto/calendar-dto';

export interface BookingActionsProps {
  readonly booking: CalendarBookingDto;
  readonly isPending: boolean;
  readonly onReschedule: () => void;
  readonly onCancel: () => void;
  readonly run: (action: () => Promise<ActionResult<unknown>>) => void;
}

/**
 * What staff may do with an open booking. Completing and marking a no-show
 * apply only to a confirmed one; a held booking can still be moved or
 * cancelled. The server checks the permission and the state again.
 */
export function BookingActions({
  booking,
  isPending,
  onReschedule,
  onCancel,
  run,
}: BookingActionsProps) {
  const t = useTranslations('booking');

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={isPending} onClick={onReschedule}>
        {t('details.reschedule')}
      </Button>
      <Button type="button" variant="destructive" disabled={isPending} onClick={onCancel}>
        {t('details.cancel')}
      </Button>
      {booking.status === 'confirmed' && (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              run(() => completeBookingAction({ bookingId: booking.id }));
            }}
          >
            {t('details.complete')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              run(() => markBookingNoShowAction({ bookingId: booking.id }));
            }}
          >
            {t('details.noShow')}
          </Button>
        </>
      )}
    </div>
  );
}
