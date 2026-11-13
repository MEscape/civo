'use client';

import { useEffect, useRef, useState } from 'react';

import { ConfirmDialog } from '@components/shared/dialog';
import { Alert, AlertDescription } from '@components/ui/alert';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { dayAfter } from '../../forms/month-calendar';
import { useOwnBooking } from '../../hooks/use-own-booking';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';

import { BookingSummary } from './booking-summary';
import { ChangeRules } from './change-rules';
import { MovePicker } from './move-picker.client';

import type { FoundBooking } from '../../hooks/use-booking-lookup';

export interface OwnBookingProps {
  readonly websiteId: string;
  readonly found: FoundBooking;
  /** The location's today and how far ahead its service books, from the catalog. */
  readonly today: string;
  readonly horizonDays: number;
}

/**
 * A visitor's own booking: what it is, what they may still do with it (the server's answer, not a
 * guess), and the two changes they can make themselves. Cancelling asks first.
 */
export function OwnBooking({ websiteId, found, today, horizonDays }: OwnBookingProps) {
  const t = useTranslations('booking');
  const own = useOwnBooking(websiteId, found, today);
  const [isAsking, setIsAsking] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const { booking } = own;
  const isSummary = own.picker === null;

  // The lookup form that held focus is gone: say where the visitor is now.
  // Returning from time selection restores focus to the summary as well.
  useEffect(() => {
    if (isSummary) {
      title.current?.focus();
    }
  }, [isSummary, own.outcome]);

  return (
    <div className="space-y-5" aria-busy={own.isPending}>
      <h3 ref={title} tabIndex={-1} className="text-xl font-semibold text-copy outline-none">
        {t('public.manage.title')}
      </h3>
      {own.outcome !== null && (
        <Alert variant="success" role="status">
          <AlertDescription>{t(`public.manage.${own.outcome}`)}</AlertDescription>
        </Alert>
      )}
      <BookingSummary booking={booking} showReference />
      {booking.status === 'confirmed' ? (
        <ChangeRules booking={booking} />
      ) : (
        <p className="text-sm text-copy-muted">{t('public.manage.notActive')}</p>
      )}
      {own.errorCode !== null && (
        <Alert variant="danger" role="alert">
          <AlertDescription>{t(messageKeyForCode(own.errorCode), MESSAGE_PARAMS)}</AlertDescription>
        </Alert>
      )}
      {own.picker === null ? (
        <div className="flex flex-wrap gap-3">
          {booking.rescheduling.isAllowed && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-11"
              disabled={own.isPending}
              onClick={own.startMove}
            >
              {t('public.manage.move')}
            </Button>
          )}
          {booking.cancellation.isAllowed && (
            <Button
              type="button"
              variant="destructive-ghost"
              size="lg"
              className="min-h-11"
              disabled={own.isPending}
              onClick={() => {
                setIsAsking(true);
              }}
            >
              {t('public.manage.cancel')}
            </Button>
          )}
        </div>
      ) : (
        <MovePicker
          picker={own.picker}
          timeZone={booking.timeZone}
          today={today}
          lastDay={dayAfter(today, horizonDays)}
          isPending={own.isPending}
          onMonth={own.showMonth}
          onDay={own.showDay}
          onMove={own.move}
          onKeep={own.stopMove}
        />
      )}
      <ConfirmDialog
        open={isAsking}
        title={t('public.manage.cancelTitle')}
        description={t('public.manage.cancelDescription')}
        confirmLabel={t('public.manage.cancelConfirm')}
        cancelLabel={t('public.manage.keep')}
        isPending={own.isPending}
        onConfirm={() => {
          setIsAsking(false);
          own.cancel();
        }}
        onCancel={() => {
          setIsAsking(false);
        }}
      />
    </div>
  );
}
