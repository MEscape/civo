import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useZonedFormat } from '../../hooks/use-zoned-format';
import { SlotPicker } from '../flow/slot-picker.client';

import type { SlotDto } from '../../dto/availability-dto';

export interface RescheduleSectionProps {
  readonly websiteId: string;
  readonly serviceId: string;
  readonly locationId: string;
  readonly participants: number;
  readonly horizonDays: number;
  readonly slot: SlotDto | null;
  readonly timeZone: string;
  readonly isPending: boolean;
  readonly keepLabel: string;
  readonly onSelect: (slot: SlotDto) => void;
  readonly onConfirm: (slot: SlotDto) => void;
  readonly onKeep: () => void;
}

/** Picks a new time from live availability and confirms the move (staff and visitors alike). */
export function RescheduleSection({
  websiteId,
  serviceId,
  locationId,
  participants,
  horizonDays,
  slot,
  timeZone,
  isPending,
  keepLabel,
  onSelect,
  onConfirm,
  onKeep,
}: RescheduleSectionProps) {
  const t = useTranslations('booking');
  const format = useZonedFormat(timeZone);

  return (
    <div className="space-y-4">
      <SlotPicker
        websiteId={websiteId}
        serviceId={serviceId}
        locationId={locationId}
        participants={participants}
        horizonDays={horizonDays}
        selectedStart={slot?.start ?? null}
        disabled={isPending}
        onSelect={onSelect}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={slot === null || isPending}
          onClick={() => {
            if (slot !== null) {
              onConfirm(slot);
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
        <Button type="button" variant="ghost" disabled={isPending} onClick={onKeep}>
          {keepLabel}
        </Button>
      </div>
    </div>
  );
}
