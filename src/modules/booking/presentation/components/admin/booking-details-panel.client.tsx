'use client';

import { useId, useState, useTransition } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import type { ActionResult } from '@lib/result';

import { cancelBookingAsStaffAction } from '../../actions/cancel-booking-as-staff-action';
import { rescheduleBookingAsStaffAction } from '../../actions/reschedule-booking-as-staff-action';
import { BookingStatusBadge } from '../shared/booking-status-badge';
import { CancelConfirmation } from '../shared/cancel-confirmation';
import { ErrorNotice } from '../shared/error-notice';
import { RescheduleSection } from '../shared/reschedule-section';

import { BookingActions } from './booking-actions';
import { BookingFacts } from './booking-facts';

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

      <BookingFacts booking={booking} resourceNames={resourceNames} timeZone={timeZone} />

      {errorCode !== null && <ErrorNotice code={errorCode} focus />}

      {canManage && isOpen && mode === 'view' && (
        <BookingActions
          booking={booking}
          isPending={isPending}
          onReschedule={() => {
            setMode('reschedule');
          }}
          onCancel={() => {
            setMode('confirm-cancel');
          }}
          run={run}
        />
      )}

      {!canManage && isOpen && <p className="text-sm text-copy-muted">{t('details.readOnly')}</p>}

      {mode === 'confirm-cancel' && (
        <CancelConfirmation
          message={t('details.confirmCancel')}
          confirmLabel={t('details.confirmCancelYes')}
          keepLabel={t('details.keep')}
          isPending={isPending}
          onConfirm={() => {
            run(() => cancelBookingAsStaffAction({ bookingId: booking.id }));
          }}
          onKeep={() => {
            setMode('view');
          }}
        />
      )}

      {mode === 'reschedule' && (
        <RescheduleSection
          websiteId={websiteId}
          serviceId={booking.serviceId}
          locationId={booking.locationId}
          participants={booking.participants}
          horizonDays={service?.horizonDays ?? FALLBACK_HORIZON_DAYS}
          slot={slot}
          timeZone={timeZone}
          isPending={isPending}
          keepLabel={t('details.keep')}
          onSelect={setSlot}
          onConfirm={(chosen) => {
            run(() =>
              rescheduleBookingAsStaffAction({ bookingId: booking.id, start: chosen.start }),
            );
          }}
          onKeep={() => {
            setMode('view');
            setSlot(null);
          }}
        />
      )}
    </section>
  );
}
