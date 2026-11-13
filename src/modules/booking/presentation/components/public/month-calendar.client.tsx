'use client';

import { Icons } from '@components/icons/icons';
import { Button } from '@components/ui/button';

import { useAppFormatters, useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import {
  dateNumberOf,
  daysOfMonth,
  firstColumnOf,
  middleOf,
  monthOf,
  shiftMonth,
} from '../../forms/month-calendar';
import { WEEKDAY_IDS } from '../../forms/week/draft';
import { useZonedFormat } from '../../hooks/use-zoned-format';

export interface MonthCalendarProps {
  readonly month: string;
  /** The location's today and the last day the service may be booked for: the months between can be shown. */
  readonly today: string;
  readonly lastDay: string;
  /** The free days of the month; `null` while they are read. */
  readonly freeDays: readonly string[] | null;
  readonly chosenDay: string | null;
  readonly disabled: boolean;
  readonly onChoose: (day: string) => void;
  readonly onMonth: (month: string) => void;
  /** Admin date fields share the calendar without suggesting that dates describe slot availability. */
  readonly availabilityHints?: boolean;
}

/** Where the 1st of a month sits in a week from Monday (static, so the classes are generated). */
const FIRST_COLUMN = [
  'col-start-1',
  'col-start-2',
  'col-start-3',
  'col-start-4',
  'col-start-5',
  'col-start-6',
  'col-start-7',
] as const;

function statusKeyOf(freeDays: readonly string[] | null) {
  if (freeDays === null) {
    return 'public.calendar.loading';
  }
  return freeDays.length === 0 ? 'public.calendar.noDays' : 'public.calendar.hint';
}

/**
 * A month of the location's calendar with the days that have free times to choose; the others are
 * shown but cannot be chosen, and each day says in words which it is. Only the month on screen is
 * read from the server; the arrows read the next or the previous one.
 */
export function MonthCalendar({
  month,
  today,
  lastDay,
  freeDays,
  chosenDay,
  disabled,
  onChoose,
  onMonth,
  availabilityHints = true,
}: MonthCalendarProps) {
  const t = useTranslations('booking');
  const format = useAppFormatters();
  const zoned = useZonedFormat();
  const free = new Set(freeDays ?? []);
  const title = format.date(middleOf(month), { month: 'long', year: 'numeric' });
  const firstColumn = FIRST_COLUMN[firstColumnOf(month) - 1];

  return (
    <div className="max-w-md space-y-3" aria-busy={freeDays === null}>
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={t('public.calendar.previous')}
          disabled={disabled || month <= monthOf(today)}
          onClick={() => {
            onMonth(shiftMonth(month, -1));
          }}
        >
          <Icons.chevronLeft className="rtl:-scale-x-100" aria-hidden="true" />
        </Button>
        <p className="font-semibold text-copy" aria-live="polite">
          {title}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={t('public.calendar.next')}
          disabled={disabled || shiftMonth(month, 1) > monthOf(lastDay)}
          onClick={() => {
            onMonth(shiftMonth(month, 1));
          }}
        >
          <Icons.chevronRight className="rtl:-scale-x-100" aria-hidden="true" />
        </Button>
      </div>
      <div role="group" aria-label={title} className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_IDS.map((weekday) => (
          <span key={weekday} aria-hidden="true" className="text-sm font-medium text-copy-muted">
            {t(`weekdays.short.${weekday}`)}
          </span>
        ))}
        {daysOfMonth(month).map((day, index) => (
          <Button
            key={day}
            type="button"
            variant={day === chosenDay ? 'default' : 'ghost'}
            aria-pressed={day === chosenDay}
            aria-label={
              availabilityHints
                ? t(free.has(day) ? 'public.calendar.dayFree' : 'public.calendar.dayFull', {
                    date: zoned.calendarDate(day),
                  })
                : zoned.calendarDate(day)
            }
            disabled={disabled || !free.has(day) || day > lastDay}
            onClick={() => {
              onChoose(day);
            }}
            className={cn(
              'h-11 px-0 text-base tabular-nums',
              index === 0 && firstColumn,
              availabilityHints && free.has(day) && 'font-semibold underline',
            )}
          >
            {dateNumberOf(day)}
          </Button>
        ))}
      </div>
      {availabilityHints && (
        <p className="text-sm text-copy-muted" role="status">
          {t(statusKeyOf(freeDays))}
        </p>
      )}
    </div>
  );
}
