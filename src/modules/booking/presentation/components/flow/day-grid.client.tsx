'use client';

import { useRef } from 'react';
import type { KeyboardEvent } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { useZonedFormat } from '../../hooks/use-zoned-format';
import { monthCells, WEEKDAYS_MONDAY_FIRST } from '../../time/month-math';

import type { SlotDto } from '../../dto/availability-dto';
import type { YearMonth } from '../../time/month-math';

const STEP_BY_KEY: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

export interface DayGridProps {
  readonly month: YearMonth;
  readonly byDate: ReadonlyMap<string, readonly SlotDto[]>;
  readonly activeDate: string | null;
  readonly disabled: boolean;
  readonly onPick: (date: string) => void;
}

/** One month of days; only days with free times can be chosen, and arrow keys move between them. */
export function DayGrid({ month, byDate, activeDate, disabled, onPick }: DayGridProps) {
  const t = useTranslations('booking');
  const format = useZonedFormat('UTC');
  const cells = monthCells(month);
  const gridRef = useRef<HTMLDivElement>(null);

  /** Arrow keys move between the days that can be chosen; Home and End jump to the first and last. */
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const buttons = Array.from(
      gridRef.current?.querySelectorAll<HTMLButtonElement>('button[data-day]:not(:disabled)') ?? [],
    );
    const index = buttons.findIndex((button) => button === document.activeElement);
    if (index === -1) {
      return;
    }
    const step = STEP_BY_KEY[event.key];
    let target: HTMLButtonElement | undefined;
    if (event.key === 'Home') {
      target = buttons[0];
    } else if (event.key === 'End') {
      target = buttons.at(-1);
    } else if (step !== undefined) {
      target = buttons[index + step];
    }
    if (target !== undefined) {
      event.preventDefault();
      target.focus();
    }
  }

  return (
    <div ref={gridRef} role="group" aria-label={t('time.dayGroup')}>
      <div
        className="grid grid-cols-7 gap-1 text-center text-xs text-copy-muted"
        aria-hidden="true"
      >
        {WEEKDAYS_MONDAY_FIRST.map((weekday) => (
          <span key={weekday}>{format.weekdayName(weekday, 'short')}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((date, position) => {
          if (date === null) {
            // eslint-disable-next-line react/no-array-index-key -- padding cells have no identity
            return <span key={`pad-${position}`} />;
          }
          const count = byDate.get(date)?.length ?? 0;
          const isActive = date === activeDate;
          return (
            <Button
              key={date}
              type="button"
              variant="outline"
              data-day={date}
              disabled={count === 0 || disabled}
              aria-pressed={isActive}
              aria-label={
                count === 0
                  ? t('time.dayUnavailable', { date: format.longDate(date) })
                  : t('time.dayAvailable', { date: format.longDate(date), count })
              }
              onClick={() => {
                onPick(date);
              }}
              onKeyDown={handleKeyDown}
              className={cn(
                'h-10 w-full px-0',
                count === 0 && 'border-transparent text-copy-muted',
                count > 0 && !isActive && 'border-border-strong text-copy',
                isActive && 'border-primary bg-primary text-primary-foreground hover:bg-primary',
              )}
            >
              {format.dayNumber(date)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
