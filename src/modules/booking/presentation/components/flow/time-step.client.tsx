'use client';

import { useState, useTransition } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { BOOKING_ERROR_CODES } from '../../../application/contracts/booking-constraints';
import { holdSlotAction } from '../../actions/hold-slot-action';
import { suggestAlternativeSlotsAction } from '../../actions/suggest-alternative-slots-action';
import { useZonedFormat } from '../../hooks/use-zoned-format';
import { ErrorNotice } from '../shared/error-notice';

import { SlotPicker } from './slot-picker.client';

import type { AlternativeSlotsDto, SlotDto } from '../../dto/availability-dto';
import type { HoldDto } from '../../dto/booking-dto';
import type { PublicServiceDto } from '../../dto/catalog-dto';

export interface TimeStepProps {
  readonly websiteId: string;
  readonly service: PublicServiceDto;
  readonly locationId: string;
  readonly participants: number;
  readonly slot: SlotDto | null;
  readonly timeZone: string | null;
  /** The editor canvas shows the flow without ever reserving anything. */
  readonly readOnly: boolean;
  readonly onChoose: (slot: SlotDto, timeZone: string) => void;
  readonly onHeld: (hold: HoldDto) => void;
  /** The chosen time was taken by someone else: it is no longer a choice. */
  readonly onTaken: () => void;
}

/** Codes that mean "someone else got there first": the visitor is offered the nearest other times. */
const TAKEN_CODES: ReadonlySet<string> = new Set([
  BOOKING_ERROR_CODES.bookingConflict,
  BOOKING_ERROR_CODES.slotUnavailable,
  BOOKING_ERROR_CODES.resourceUnavailable,
  BOOKING_ERROR_CODES.capacityExceeded,
]);

export function TimeStep({
  websiteId,
  service,
  locationId,
  participants,
  slot,
  timeZone,
  readOnly,
  onChoose,
  onHeld,
  onTaken,
}: TimeStepProps) {
  const t = useTranslations('booking');
  const format = useZonedFormat(timeZone ?? 'UTC');
  const [isPending, startTransition] = useTransition();
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<AlternativeSlotsDto | null>(null);
  /** Bumped when the picker must reload because a time turned out to be gone. */
  const [pickerVersion, setPickerVersion] = useState(0);

  function reserve(target: SlotDto, zone: string) {
    setErrorCode(null);
    setAlternatives(null);
    startTransition(async () => {
      const held = await holdSlotAction({
        websiteId,
        serviceId: service.id,
        locationId,
        start: target.start,
        participants,
      });
      if (held.ok) {
        onHeld(held.data);
        return;
      }
      setErrorCode(held.error.code);
      if (TAKEN_CODES.has(held.error.code)) {
        setPickerVersion((version) => version + 1);
        const suggested = await suggestAlternativeSlotsAction({
          websiteId,
          serviceId: service.id,
          locationId,
          start: target.start,
          participants,
        });
        if (suggested.ok) {
          setAlternatives(suggested.data);
        }
        onTaken();
        return;
      }
      onChoose(target, zone);
    });
  }

  return (
    <div className="space-y-4">
      <SlotPicker
        key={pickerVersion}
        websiteId={websiteId}
        serviceId={service.id}
        locationId={locationId}
        participants={participants}
        horizonDays={service.horizonDays}
        selectedStart={slot?.start ?? null}
        disabled={isPending}
        onSelect={(chosen, zone) => {
          setErrorCode(null);
          setAlternatives(null);
          onChoose(chosen, zone);
        }}
      />

      {errorCode !== null && <ErrorNotice code={errorCode} focus />}

      {alternatives !== null && alternatives.slots.length > 0 && (
        <section aria-label={t('time.alternativesLabel')} className="space-y-2">
          <p className="text-sm font-medium text-copy">{t('time.alternativesIntro')}</p>
          <ul className="flex flex-wrap gap-2">
            {alternatives.slots.map((alternative) => (
              <li key={alternative.start}>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending || readOnly}
                  onClick={() => {
                    onChoose(alternative, alternatives.timeZone);
                    reserve(alternative, alternatives.timeZone);
                  }}
                >
                  {t('time.alternativeOption', {
                    date: format.shortDate(alternative.localDate),
                    time: format.timeOfDay(alternative.localTime),
                  })}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {slot !== null && timeZone !== null && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <p className="text-sm text-copy" role="status">
            {t('time.selected', {
              date: format.longDate(slot.localDate),
              time: format.timeOfDay(slot.localTime),
            })}
          </p>
          <Button
            type="button"
            disabled={isPending || readOnly}
            onClick={() => {
              reserve(slot, timeZone);
            }}
          >
            {isPending ? t('time.reserving') : t('actions.continue')}
          </Button>
          {readOnly && <p className="text-xs text-copy-muted">{t('preview.disabled')}</p>}
        </div>
      )}
    </div>
  );
}
