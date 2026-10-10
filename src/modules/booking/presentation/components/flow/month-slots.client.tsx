'use client';

import { useMemo, useState } from 'react';

import { useTranslations } from '@i18n/client';

import { DayGrid } from './day-grid.client';
import { TimeList } from './time-list.client';

import type { AvailabilityDto, SlotDto } from '../../dto/availability-dto';
import type { YearMonth } from '../../time/month-math';

function groupByDate(slots: readonly SlotDto[]): ReadonlyMap<string, readonly SlotDto[]> {
  const byDate = new Map<string, SlotDto[]>();
  for (const slot of slots) {
    const list = byDate.get(slot.localDate);
    if (list === undefined) {
      byDate.set(slot.localDate, [slot]);
    } else {
      list.push(slot);
    }
  }
  return byDate;
}

/** The day to show times for: the one clicked, else the one holding the selected slot, if either has times. */
function activeDateOf(
  picked: string | null,
  selectedDay: string | undefined,
  byDate: ReadonlyMap<string, readonly SlotDto[]>,
): string | null {
  return (
    [picked, selectedDay].find((date) => date !== null && date !== undefined && byDate.has(date)) ??
    null
  );
}

export interface MonthSlotsProps {
  readonly month: YearMonth;
  readonly monthLabel: string;
  readonly availability: AvailabilityDto;
  readonly selectedStart: string | null;
  readonly disabled: boolean;
  readonly onSelect: (slot: SlotDto, timeZone: string) => void;
}

/**
 * One month of free times: a note in which zone they are read, then the days
 * and the times of the chosen day. The picked day resets when the month
 * changes because the parent keys this component by month.
 */
export function MonthSlots({
  month,
  monthLabel,
  availability,
  selectedStart,
  disabled,
  onSelect,
}: MonthSlotsProps) {
  const t = useTranslations('booking');
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const byDate = useMemo(() => groupByDate(availability.slots), [availability]);
  const selectedDay = availability.slots.find((slot) => slot.start === selectedStart)?.localDate;
  const activeDate = activeDateOf(pickedDate, selectedDay, byDate);

  return (
    <>
      <p className="text-sm text-copy-muted">
        {t('time.zoneNote', { zone: availability.timeZone })}
      </p>
      {availability.slots.length === 0 ? (
        <p
          role="status"
          className="rounded-token border border-border bg-canvas p-4 text-sm text-copy"
        >
          {t('time.noTimesInMonth', { month: monthLabel })}
        </p>
      ) : (
        <>
          <DayGrid
            month={month}
            byDate={byDate}
            activeDate={activeDate}
            disabled={disabled}
            onPick={setPickedDate}
          />
          {activeDate === null ? (
            <p className="text-sm text-copy-muted">{t('time.chooseDay')}</p>
          ) : (
            <TimeList
              date={activeDate}
              times={byDate.get(activeDate) ?? []}
              selectedStart={selectedStart}
              disabled={disabled}
              onSelect={(slot) => {
                onSelect(slot, availability.timeZone);
              }}
            />
          )}
        </>
      )}
    </>
  );
}
