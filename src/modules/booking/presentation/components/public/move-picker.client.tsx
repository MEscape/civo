'use client';

import { useEffect, useState } from 'react';

import { Button } from '@components/ui/button';

import { useStepFocus } from '@hooks/use-step-focus';

import { useTranslations } from '@i18n/client';

import { useZonedFormat } from '../../hooks/use-zoned-format';

import { DayTimes } from './day-times.client';
import { MonthCalendar } from './month-calendar.client';

import type { SlotDto } from '../../forms/journey-state';

export interface MovePickerProps {
  readonly picker: {
    readonly month: string;
    readonly days: readonly string[] | null;
    readonly day: string | null;
    readonly times: readonly SlotDto[] | null;
  };
  readonly timeZone: string;
  readonly today: string;
  readonly lastDay: string;
  readonly isPending: boolean;
  readonly onMonth: (month: string) => void;
  readonly onDay: (day: string) => void;
  readonly onMove: (slot: SlotDto) => void;
  readonly onKeep: () => void;
}

/**
 * The new time of a booking: a free day of the month, then a free time of it, then one press to move
 * the booking there; the old time is given up in the same step.
 */
export function MovePicker({
  picker,
  timeZone,
  today,
  lastDay,
  isPending,
  onMonth,
  onDay,
  onMove,
  onKeep,
}: MovePickerProps) {
  const t = useTranslations('booking');
  const zoned = useZonedFormat();
  const [slot, setSlot] = useState<SlotDto | null>(null);
  const { headingId, headingRef } = useStepFocus('move');

  useEffect(() => {
    headingRef.current?.focus();
  }, [headingRef]);

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <h4 id={headingId} ref={headingRef} tabIndex={-1} className="font-semibold text-copy">
        {t('public.manage.moveTitle')}
      </h4>
      <MonthCalendar
        month={picker.month}
        today={today}
        lastDay={lastDay}
        freeDays={picker.days}
        chosenDay={picker.day}
        disabled={isPending}
        onChoose={onDay}
        onMonth={onMonth}
      />
      {picker.day !== null && (
        <DayTimes
          day={picker.day}
          timeZone={timeZone}
          times={picker.times}
          chosenStart={slot?.start ?? null}
          disabled={isPending}
          onChoose={setSlot}
        />
      )}
      {slot !== null && picker.times?.includes(slot) === true && (
        <Button
          type="button"
          size="lg"
          className="h-auto min-h-11 py-2 text-start whitespace-normal"
          aria-disabled={isPending}
          onClick={() => {
            if (!isPending) {
              onMove(slot);
            }
          }}
        >
          {isPending
            ? t('public.manage.moving')
            : t('public.manage.moveTo', { time: zoned.dateTime(slot.start, timeZone) })}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        className="min-h-11"
        disabled={isPending}
        onClick={onKeep}
      >
        {t('public.manage.keep')}
      </Button>
    </section>
  );
}
