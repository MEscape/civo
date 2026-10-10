'use client';

import { useId, useState, useTransition } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import type { ActionResult } from '@lib/result';

import { cancelBookingAsStaffAction } from '../../actions/cancel-booking-as-staff-action';
import { completeBookingAction } from '../../actions/complete-booking-action';
import { markBookingNoShowAction } from '../../actions/mark-booking-no-show-action';
import { rescheduleBookingAsStaffAction } from '../../actions/reschedule-booking-as-staff-action';
import { useZonedFormat } from '../../hooks/use-zoned-format';
import { SlotPicker } from '../flow/slot-picker.client';
import { BookingStatusBadge } from '../shared/booking-status-badge';
import { ErrorNotice } from '../shared/error-notice';

import type { SlotDto } from '../../dto/availability-dto';
import type { CalendarBookingDto } from '../../dto/calendar-dto';
import type { BookingSetupDto } from '../../dto/setup-dto';

export interface BookingDetailsPanelProps {
  readonly websiteId: string;
  readonly booking: CalendarBookingDto;
  readonly setup: BookingSetupDto;
  readonly canManage: boolean;
  readonly timeZone: string;
  readonly onChanged: () => void;
  readonly onClose: () => void;
}

type Mode = 'view' | 'confirm-cancel' | 'reschedule';

const FALLBACK_HORIZON_DAYS = 365;

/**
 * One booking, in full, with the actions staff may take. What is offered
 * depends on the booking's state (a cancelled booking has no actions) and on
 * the person's permission; the server checks both again on every action.
 */
export function BookingDetailsPanel({
  websiteId,
  booking,
  setup,
  canManage,
  timeZone,
  onChanged,
  onClose,
}: BookingDetailsPanelProps) {
  const t = useTranslations('booking');
  const id = useId();
  const format = useZonedFormat(timeZone);
  const [mode, setMode] = useState<Mode>('view');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotDto | null>(null);
  const [isPending, startTransition] = useTransition();

  const service = setup.services.find((candidate) => candidate.id === booking.serviceId);
  const resourceNames = booking.resourceIds
    .map((resourceId) => setup.resources.find((resource) => resource.id === resourceId)?.name)
    .filter((name) => name !== undefined);
  const isOpen = booking.status === 'confirmed' || booking.status === 'held';

  function run(action: () => Promise<ActionResult<unknown>>) {
    setErrorCode(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setMode('view');
        setSlot(null);
        onChanged();
      } else {
        setErrorCode(result.error.code);
      }
    });
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="space-y-4 rounded-token border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 id={`${id}-title`} className="text-base font-medium text-copy">
            {booking.serviceName}
          </h3>
          <p className="font-mono text-sm text-copy-muted">{booking.reference}</p>
        </div>
        <div className="flex items-center gap-2">
          <BookingStatusBadge status={booking.status} />
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('details.close')}
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-copy-muted">{t('summary.when')}</dt>
        <dd className="text-copy">{format.dateTime(booking.start)}</dd>
        <dt className="text-copy-muted">{t('summary.participants')}</dt>
        <dd className="text-copy">{booking.participants}</dd>
        {resourceNames.length > 0 && (
          <>
            <dt className="text-copy-muted">{t('details.resources')}</dt>
            <dd className="text-copy">{resourceNames.join(', ')}</dd>
          </>
        )}
        <dt className="text-copy-muted">{t('details.customer')}</dt>
        <dd className="text-copy">{booking.customerName ?? t('review.notProvided')}</dd>
        <dt className="text-copy-muted">{t('fields.email')}</dt>
        <dd className="break-all text-copy">{booking.customerEmail ?? t('review.notProvided')}</dd>
        {booking.customerPhone !== null && (
          <>
            <dt className="text-copy-muted">{t('fields.phone')}</dt>
            <dd className="text-copy">{booking.customerPhone}</dd>
          </>
        )}
        {booking.notes !== null && (
          <>
            <dt className="text-copy-muted">{t('fields.notes')}</dt>
            <dd className="whitespace-pre-line break-words text-copy">{booking.notes}</dd>
          </>
        )}
        {booking.rescheduleCount > 0 && (
          <>
            <dt className="text-copy-muted">{t('details.rescheduled')}</dt>
            <dd className="text-copy">{booking.rescheduleCount}</dd>
          </>
        )}
        {booking.cancelledBy !== null && (
          <>
            <dt className="text-copy-muted">{t('details.cancelledBy')}</dt>
            <dd className="text-copy">{t(`actors.${booking.cancelledBy}`)}</dd>
          </>
        )}
      </dl>

      {errorCode !== null && <ErrorNotice code={errorCode} focus />}

      {canManage && isOpen && mode === 'view' && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              setMode('reschedule');
            }}
          >
            {t('details.reschedule')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              setMode('confirm-cancel');
            }}
          >
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
      )}

      {!canManage && isOpen && <p className="text-sm text-copy-muted">{t('details.readOnly')}</p>}

      {mode === 'confirm-cancel' && (
        <div
          role="alertdialog"
          aria-labelledby={`${id}-cancel`}
          className="space-y-3 rounded-token border border-danger-border bg-danger-subtle p-4"
        >
          <p id={`${id}-cancel`} className="text-sm font-medium text-danger">
            {t('details.confirmCancel')}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                run(() => cancelBookingAsStaffAction({ bookingId: booking.id }));
              }}
            >
              {t('details.confirmCancelYes')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                setMode('view');
              }}
            >
              {t('details.keep')}
            </Button>
          </div>
        </div>
      )}

      {mode === 'reschedule' && (
        <div className="space-y-4">
          <SlotPicker
            websiteId={websiteId}
            serviceId={booking.serviceId}
            locationId={booking.locationId}
            participants={booking.participants}
            horizonDays={service?.horizonDays ?? FALLBACK_HORIZON_DAYS}
            selectedStart={slot?.start ?? null}
            disabled={isPending}
            onSelect={(chosen) => {
              setSlot(chosen);
            }}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={slot === null || isPending}
              onClick={() => {
                if (slot !== null) {
                  run(() =>
                    rescheduleBookingAsStaffAction({ bookingId: booking.id, start: slot.start }),
                  );
                }
              }}
            >
              {slot === null
                ? t('manage.moveChoose')
                : t('manage.moveTo', {
                    date: format.shortDate(slot.localDate),
                    time: format.timeOfDay(slot.localTime),
                  })}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                setMode('view');
                setSlot(null);
              }}
            >
              {t('details.keep')}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
