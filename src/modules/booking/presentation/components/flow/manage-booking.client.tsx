'use client';

import { useId, useState, useTransition } from 'react';

import { FieldMessage } from '@components/shared/field-message';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input, Label } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { cancelOwnBookingAction } from '../../actions/cancel-own-booking-action';
import { findBookingAction } from '../../actions/find-booking-action';
import { rescheduleOwnBookingAction } from '../../actions/reschedule-own-booking-action';
import { useZonedFormat } from '../../hooks/use-zoned-format';
import { STATUS_MESSAGE_KEYS } from '../../messages/message-keys';
import { ErrorNotice } from '../shared/error-notice';

import { BookingSummary } from './booking-summary';
import { SlotPicker } from './slot-picker.client';

import type { SlotDto } from '../../dto/availability-dto';
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

type Mode = 'view' | 'confirm-cancel' | 'reschedule';

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
  const id = useId();
  const [reference, setReference] = useState(initial?.booking.reference ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [booking, setBooking] = useState<BookingDto | null>(initial?.booking ?? null);
  const [accessEmail, setAccessEmail] = useState(initial?.email ?? '');
  const [mode, setMode] = useState<Mode>('view');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotDto | null>(null);
  const [isPending, startTransition] = useTransition();
  const [touched, setTouched] = useState(false);

  const format = useZonedFormat(booking?.timeZone ?? 'UTC');

  function lookUp() {
    setTouched(true);
    if (reference.trim() === '' || email.trim() === '') {
      return;
    }
    setErrorCode(null);
    startTransition(async () => {
      const found = await findBookingAction({ websiteId, reference, email });
      if (found.ok) {
        setBooking(found.data);
        setAccessEmail(email);
        setMode('view');
      } else {
        setErrorCode(found.error.code);
      }
    });
  }

  function cancel(target: BookingDto) {
    setErrorCode(null);
    startTransition(async () => {
      const cancelled = await cancelOwnBookingAction({
        websiteId,
        reference: target.reference,
        email: accessEmail,
      });
      if (cancelled.ok) {
        setBooking(cancelled.data);
        setMode('view');
      } else {
        setErrorCode(cancelled.error.code);
      }
    });
  }

  function move(target: BookingDto, chosen: SlotDto) {
    setErrorCode(null);
    startTransition(async () => {
      const moved = await rescheduleOwnBookingAction({
        websiteId,
        reference: target.reference,
        email: accessEmail,
        start: chosen.start,
      });
      if (moved.ok) {
        setBooking(moved.data);
        setSlot(null);
        setMode('view');
      } else {
        setErrorCode(moved.error.code);
      }
    });
  }

  if (booking === null) {
    return (
      <form
        noValidate
        className="max-w-md space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          lookUp();
        }}
      >
        <p className="text-sm text-copy-muted">{t('manage.intro')}</p>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-reference`}>{t('manage.reference')}</Label>
          <Input
            id={`${id}-reference`}
            value={reference}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={touched && reference.trim() === '' ? true : undefined}
            onChange={(event) => {
              setReference(event.target.value);
            }}
          />
          <FieldMessage
            id={`${id}-reference-error`}
            message={touched && reference.trim() === '' ? t('manage.referenceRequired') : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-email`}>{t('manage.email')}</Label>
          <Input
            id={`${id}-email`}
            type="email"
            value={email}
            autoComplete="email"
            aria-invalid={touched && email.trim() === '' ? true : undefined}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
          <FieldMessage
            id={`${id}-email-error`}
            message={touched && email.trim() === '' ? t('manage.emailRequired') : undefined}
          />
        </div>
        {errorCode !== null && <ErrorNotice code={errorCode} focus />}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onBack}>
            {t('actions.back')}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? t('manage.searching') : t('manage.find')}
          </Button>
        </div>
      </form>
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
        showParticipants={(service?.maxParticipantsPerBooking ?? 1) > 1}
      />

      {errorCode !== null && <ErrorNotice code={errorCode} focus />}

      {isLive && mode === 'view' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!booking.canReschedule || isPending || readOnly}
              onClick={() => {
                setErrorCode(null);
                setMode('reschedule');
              }}
            >
              {t('manage.reschedule')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!booking.canCancel || isPending || readOnly}
              onClick={() => {
                setErrorCode(null);
                setMode('confirm-cancel');
              }}
            >
              {t('manage.cancel')}
            </Button>
          </div>
          {(!booking.canReschedule || !booking.canCancel) && (
            <p className="text-sm text-copy-muted">{t('manage.limited')}</p>
          )}
        </div>
      )}

      {!isLive && (
        <p className="text-sm text-copy-muted" role="status">
          {t('manage.notActive')}
        </p>
      )}

      {mode === 'confirm-cancel' && (
        <div
          role="alertdialog"
          aria-labelledby={`${id}-cancel`}
          className="space-y-3 rounded-token border border-danger-border bg-danger-subtle p-4"
        >
          <p id={`${id}-cancel`} className="text-sm font-medium text-danger">
            {t('manage.confirmCancel')}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                cancel(booking);
              }}
            >
              {isPending ? t('manage.cancelling') : t('manage.confirmCancelYes')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                setMode('view');
              }}
            >
              {t('manage.keep')}
            </Button>
          </div>
        </div>
      )}

      {mode === 'reschedule' && (
        <section className="space-y-4" aria-label={t('manage.rescheduleTitle')}>
          <h4 className="text-base font-medium text-copy">{t('manage.rescheduleTitle')}</h4>
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={slot === null || isPending}
              onClick={() => {
                if (slot !== null) {
                  move(booking, slot);
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
              {t('manage.keep')}
            </Button>
          </div>
        </section>
      )}

      <Button type="button" variant="link" onClick={onBack}>
        {t('manage.backToBooking')}
      </Button>
    </div>
  );
}
