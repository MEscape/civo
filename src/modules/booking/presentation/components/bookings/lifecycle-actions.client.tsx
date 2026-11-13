'use client';

import { useState } from 'react';

import { ChevronDown } from '@components/icons/icons';
import { ConfirmDialog } from '@components/shared/dialog';
import { Button } from '@components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';

import { useTranslations } from '@i18n/client';

import { cancelBookingAction } from '../../actions/cancel-booking-action';
import { completeBookingAction } from '../../actions/complete-booking-action';
import { markBookingNoShowAction } from '../../actions/mark-booking-no-show-action';
import { useBookingCommand } from '../../hooks/use-booking-command';
import { useBookingWebsite } from '../../hooks/use-booking-website';

import { RescheduleDialog } from './reschedule-dialog.client';

import type { BookingDto } from '../../dto/booking-dto';

export interface LifecycleActionsProps {
  readonly booking: Pick<BookingDto, 'id' | 'start' | 'status'>;
}

/**
 * What a manager can do with the booking itself, as its status allows (the server decides again),
 * behind one "Actions" menu so the details are not crowded by buttons: move it, record that it took
 * place or that nobody came, and cancel it after a confirmation. Nothing is offered when nothing is allowed.
 */
export function LifecycleActions({ booking }: LifecycleActionsProps) {
  const t = useTranslations('booking');
  const [dialog, setDialog] = useState<'reschedule' | 'cancel' | null>(null);
  const websiteId = useBookingWebsite();
  const command = useBookingCommand();
  const target = { websiteId, bookingId: booking.id };
  const isConfirmed = booking.status === 'confirmed';
  const mayCancel = isConfirmed || booking.status === 'held';

  if (!isConfirmed && !mayCancel) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" disabled={command.isPending}>
            {t('bookings.actions.menu')}
            <ChevronDown aria-hidden="true" className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {isConfirmed && (
            <>
              <DropdownMenuItem
                onSelect={() => {
                  setDialog('reschedule');
                }}
              >
                {t('bookings.actions.reschedule')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  command.run(() => completeBookingAction(target));
                }}
              >
                {t('bookings.actions.complete')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  command.run(() => markBookingNoShowAction(target));
                }}
              >
                {t('bookings.actions.noShow')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            className="text-danger"
            onSelect={() => {
              setDialog('cancel');
            }}
          >
            {t('bookings.actions.cancel')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <p role="status" className="basis-full text-sm text-copy-muted empty:hidden">
        {command.message}
      </p>
      {isConfirmed && (
        <RescheduleDialog
          booking={booking}
          isOpen={dialog === 'reschedule'}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
      <ConfirmDialog
        open={dialog === 'cancel'}
        title={t('bookings.actions.cancelTitle')}
        description={t('bookings.actions.cancelBody')}
        confirmLabel={t('bookings.actions.cancel')}
        cancelLabel={t('bookings.actions.back')}
        isPending={command.isPending}
        onCancel={() => {
          setDialog(null);
        }}
        onConfirm={() => {
          command.run(() => cancelBookingAction(target), {
            onDone: () => {
              setDialog(null);
            },
            onRace: () => {
              setDialog(null);
            },
          });
        }}
      />
    </>
  );
}
