'use client';

import { useEffect } from 'react';

import { ConfirmDialog, DialogNotice } from '@components/shared/dialog';

import { useTranslations } from '@i18n/client';

import { rescheduleBookingAction } from '../../actions/reschedule-booking-action';
import { dayOf } from '../../forms/month-calendar';
import { useBookingCommand } from '../../hooks/use-booking-command';
import { useBookingWebsite } from '../../hooks/use-booking-website';
import { useStaffSlots } from '../../hooks/use-staff-slots';

import { SlotPicker } from './slot-picker.client';

import type { BookingDto } from '../../dto/booking-dto';

export interface RescheduleDialogProps {
  readonly booking: Pick<BookingDto, 'id' | 'start'>;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/** Moves a booking to a free time the engine offers on a chosen day, at the same location. */
export function RescheduleDialog({ booking, isOpen, onClose }: RescheduleDialogProps) {
  const t = useTranslations('booking');
  const picker = useStaffSlots(dayOf(booking.start));
  const websiteId = useBookingWebsite();
  const command = useBookingCommand();
  const source = { bookingId: booking.id };

  // The slots are read when the dialog opens: the day of the booking, then whichever day is chosen.
  useEffect(() => {
    if (isOpen) {
      command.clear();
      picker.load(picker.day, source);
    }
    // Only the opening matters: choosing another day loads through the picker itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `command` and `picker` change on every render; only the opening is a reason to load
  }, [isOpen]);

  return (
    <ConfirmDialog
      open={isOpen}
      confirmVariant="default"
      title={t('bookings.reschedule.title')}
      description={t('bookings.reschedule.description')}
      confirmLabel={t('bookings.reschedule.confirm')}
      cancelLabel={t('bookings.reschedule.cancel')}
      isConfirmDisabled={picker.start === null}
      isPending={command.isPending}
      onCancel={onClose}
      onConfirm={() => {
        const start = picker.start;
        if (start !== null) {
          command.run(() => rescheduleBookingAction({ websiteId, bookingId: booking.id, start }), {
            onDone: onClose,
            onRace: () => {
              picker.load(picker.day, source);
            },
          });
        }
      }}
    >
      <SlotPicker picker={picker} source={source} />
      {command.message !== null && command.message !== '' && (
        <div className="mt-3">
          <DialogNotice tone="danger">{command.message}</DialogNotice>
        </div>
      )}
    </ConfirmDialog>
  );
}
