'use client';

import { Button } from '@components/ui/button';
import { Skeleton } from '@components/ui/skeleton';

import { useTranslations } from '@i18n/client';

import { useZonedFormat } from '../../hooks/use-zoned-format';

import type { SlotDto } from '../../forms/journey-state';

const SLOT_PLACEHOLDERS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

export interface DayTimesProps {
  readonly day: string;
  readonly timeZone: string;
  /** The free starts of the day; `null` while they are read. */
  readonly times: readonly SlotDto[] | null;
  /** The start chosen before, if the visitor came back to this step. */
  readonly chosenStart: string | null;
  readonly disabled: boolean;
  readonly onChoose: (slot: SlotDto) => void;
}

/** The free times of one day on the location's clock; pressing one chooses it. */
export function DayTimes({ day, timeZone, times, chosenStart, disabled, onChoose }: DayTimesProps) {
  const t = useTranslations('booking');
  const zoned = useZonedFormat();
  const label = t('public.times.label', { date: zoned.calendarDate(day) });

  if (times?.length === 0) {
    return (
      <p role="status" className="text-sm text-copy-muted">
        {t('public.times.none')}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <ul
        aria-label={label}
        aria-busy={times === null}
        className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2"
      >
        {times === null
          ? SLOT_PLACEHOLDERS.map((placeholder) => (
              <li key={placeholder} aria-hidden="true">
                <Skeleton className="h-11 w-full" />
              </li>
            ))
          : times.map((slot) => (
              <li key={slot.start}>
                <Button
                  type="button"
                  variant={slot.start === chosenStart ? 'default' : 'outline'}
                  aria-pressed={slot.start === chosenStart}
                  disabled={disabled}
                  onClick={() => {
                    onChoose(slot);
                  }}
                  className="h-11 w-full tabular-nums"
                >
                  {zoned.time(slot.start, timeZone)}
                </Button>
              </li>
            ))}
      </ul>
      {times === null && (
        <p role="status" className="sr-only">
          {t('public.times.loading')}
        </p>
      )}
      <p className="text-sm text-copy-muted">{t('public.times.zone', { zone: timeZone })}</p>
    </div>
  );
}
