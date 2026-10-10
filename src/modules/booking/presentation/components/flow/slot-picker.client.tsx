'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { Button } from '@components/ui/button';
import { Icons } from '@components/ui/icons';
import { Skeleton } from '@components/ui/skeleton';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { getAvailableSlotsAction } from '../../actions/get-available-slots-action';
import { useZonedFormat } from '../../hooks/use-zoned-format';
import { ErrorNotice } from '../shared/error-notice';

import {
  compareYearMonth,
  currentYearMonth,
  firstDayOf,
  lastDayOf,
  monthCells,
  shiftMonth,
  yearMonthAfterDays,
} from './month-math';

import type { YearMonth } from './month-math';
import type { AvailabilityDto, SlotDto } from '../../dto/availability-dto';

export interface SlotPickerProps {
  readonly websiteId: string;
  readonly serviceId: string;
  readonly locationId: string;
  readonly participants: number;
  /** The furthest ahead a visitor can book, in days; the picker will not page past it. */
  readonly horizonDays: number;
  /** The slot already chosen, if any, so it is shown as selected when the picker opens. */
  readonly selectedStart: string | null;
  readonly disabled?: boolean;
  readonly onSelect: (slot: SlotDto, timeZone: string) => void;
}

type Outcome =
  | { readonly kind: 'ready'; readonly availability: AvailabilityDto }
  | { readonly kind: 'failed'; readonly code: string };

interface Loaded {
  readonly key: string;
  readonly outcome: Outcome;
}

/** When the first month has nothing, look ahead this many months before showing an empty one. */
const MAX_AUTO_ADVANCE = 3;
const MORNING_END = '12:00';
const AFTERNOON_END = '17:00';
const WEEKDAYS_IN_ORDER = [1, 2, 3, 4, 5, 6, 7] as const;

type DayPart = 'morning' | 'afternoon' | 'evening';

function dayPartOf(localTime: string): DayPart {
  if (localTime < MORNING_END) {
    return 'morning';
  }
  return localTime < AFTERNOON_END ? 'afternoon' : 'evening';
}

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

/**
 * Purpose-built slot picker: a month of days (only days with free times can
 * be chosen) and the times of the chosen day as a radio group. It shows the
 * wall-clock time AT THE LOCATION and says so, and it always reads live
 * availability from the server; nothing here is cached or assumed free.
 */
export function SlotPicker({
  websiteId,
  serviceId,
  locationId,
  participants,
  horizonDays,
  selectedStart,
  disabled = false,
  onSelect,
}: SlotPickerProps) {
  const t = useTranslations('booking');
  const headingId = useId();
  const [month, setMonth] = useState<YearMonth>(() => currentYearMonth());
  const [attempt, setAttempt] = useState(0);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const autoAdvanceLeft = useRef(selectedStart === null ? MAX_AUTO_ADVANCE : 0);

  const from = firstDayOf(month);
  const to = lastDayOf(month);
  const requestKey = `${serviceId}|${locationId}|${participants}|${from}|${attempt}`;
  const lastMonth = useMemo(() => yearMonthAfterDays(horizonDays), [horizonDays]);
  const firstMonth = useMemo(() => currentYearMonth(), []);

  useEffect(() => {
    let cancelled = false;
    void getAvailableSlotsAction({ websiteId, serviceId, locationId, from, to, participants }).then(
      (result) => {
        if (cancelled) {
          return;
        }
        if (!result.ok) {
          setLoaded({ key: requestKey, outcome: { kind: 'failed', code: result.error.code } });
          return;
        }
        const nextMonth = shiftMonth(month, 1);
        if (
          result.data.slots.length === 0 &&
          autoAdvanceLeft.current > 0 &&
          compareYearMonth(nextMonth, lastMonth) <= 0
        ) {
          autoAdvanceLeft.current -= 1;
          setMonth(nextMonth);
          return;
        }
        autoAdvanceLeft.current = 0;
        setLoaded({ key: requestKey, outcome: { kind: 'ready', availability: result.data } });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [websiteId, serviceId, locationId, participants, from, to, requestKey, month, lastMonth]);

  const outcome = loaded?.key === requestKey ? loaded.outcome : null;
  const availability = outcome?.kind === 'ready' ? outcome.availability : null;
  const timeZone = availability?.timeZone ?? 'UTC';
  const format = useZonedFormat(timeZone);

  const byDate = useMemo(() => groupByDate(availability?.slots ?? []), [availability]);
  const selectedDay =
    selectedStart === null
      ? null
      : (availability?.slots.find((s) => s.start === selectedStart)?.localDate ?? null);
  const activeDate = [pickedDate, selectedDay].find((d) => d !== null && byDate.has(d)) ?? null;
  const times = activeDate === null ? [] : (byDate.get(activeDate) ?? []);

  function goToMonth(delta: number) {
    autoAdvanceLeft.current = 0;
    setPickedDate(null);
    setMonth(shiftMonth(month, delta));
  }

  const canGoBack = compareYearMonth(shiftMonth(month, -1), firstMonth) >= 0;
  const canGoForward = compareYearMonth(shiftMonth(month, 1), lastMonth) <= 0;
  const monthLabel = format.monthYear(from);

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 id={headingId} className="text-base font-medium text-copy" aria-live="polite">
          {monthLabel}
        </h3>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              goToMonth(-1);
            }}
            disabled={!canGoBack || disabled}
            aria-label={t('time.previousMonth')}
          >
            <Icons.chevronLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              goToMonth(1);
            }}
            disabled={!canGoForward || disabled}
            aria-label={t('time.nextMonth')}
          >
            <Icons.chevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>

      {outcome === null && <PickerSkeleton label={t('time.loading')} />}

      {outcome?.kind === 'failed' && (
        <div className="space-y-3">
          <ErrorNotice code={outcome.code} />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setAttempt((count) => count + 1);
            }}
          >
            {t('time.retry')}
          </Button>
        </div>
      )}

      {availability !== null && (
        <>
          <p className="text-sm text-copy-muted">{t('time.zoneNote', { zone: timeZone })}</p>
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
              {activeDate !== null && (
                <TimeList
                  date={activeDate}
                  times={times}
                  selectedStart={selectedStart}
                  disabled={disabled}
                  onSelect={(slot) => {
                    onSelect(slot, availability.timeZone);
                  }}
                />
              )}
              {activeDate === null && (
                <p className="text-sm text-copy-muted">{t('time.chooseDay')}</p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function PickerSkeleton({ label }: { readonly label: string }) {
  return (
    <div aria-busy="true" className="space-y-2">
      <p role="status" className="sr-only">
        {label}
      </p>
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

interface DayGridProps {
  readonly month: YearMonth;
  readonly byDate: ReadonlyMap<string, readonly SlotDto[]>;
  readonly activeDate: string | null;
  readonly disabled: boolean;
  readonly onPick: (date: string) => void;
}

function DayGrid({ month, byDate, activeDate, disabled, onPick }: DayGridProps) {
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
    const step: Record<string, number | undefined> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    let target: HTMLButtonElement | undefined;
    if (event.key === 'Home') {
      target = buttons[0];
    } else if (event.key === 'End') {
      target = buttons.at(-1);
    } else if (step[event.key] !== undefined) {
      target = buttons[index + (step[event.key] ?? 0)];
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
        {WEEKDAYS_IN_ORDER.map((weekday) => (
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

interface TimeListProps {
  readonly date: string;
  readonly times: readonly SlotDto[];
  readonly selectedStart: string | null;
  readonly disabled: boolean;
  readonly onSelect: (slot: SlotDto) => void;
}

const DAY_PARTS: readonly DayPart[] = ['morning', 'afternoon', 'evening'];
/** A group of places is worth mentioning only when it is getting short. */
const FEW_PLACES = 10;

function TimeList({ date, times, selectedStart, disabled, onSelect }: TimeListProps) {
  const t = useTranslations('booking');
  const format = useZonedFormat('UTC');
  const groupName = useId();
  const labelId = useId();

  return (
    <div role="radiogroup" aria-labelledby={labelId} className="space-y-3">
      <h4 id={labelId} className="text-sm font-medium text-copy">
        {t('time.timesOn', { date: format.longDate(date) })}
      </h4>
      {DAY_PARTS.map((part) => {
        const inPart = times.filter((slot) => dayPartOf(slot.localTime) === part);
        if (inPart.length === 0) {
          return null;
        }
        return (
          <div key={part} className="space-y-1.5">
            <p className="text-xs uppercase tracking-wide text-copy-muted">
              {t(`time.parts.${part}`)}
            </p>
            <div className="flex flex-wrap gap-2">
              {inPart.map((slot) => (
                <label
                  key={slot.start}
                  className={cn(
                    'relative flex min-w-20 cursor-pointer flex-col items-center rounded-token border px-3 py-2 text-sm',
                    'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
                    slot.start === selectedStart
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border-strong bg-surface text-copy hover:bg-canvas',
                    disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <input
                    type="radio"
                    name={groupName}
                    className="sr-only"
                    checked={slot.start === selectedStart}
                    disabled={disabled}
                    onChange={() => {
                      onSelect(slot);
                    }}
                  />
                  <span>{format.timeOfDay(slot.localTime)}</span>
                  {slot.remainingParticipants > 1 && slot.remainingParticipants <= FEW_PLACES && (
                    <span className="text-xs opacity-80">
                      {t('time.placesLeft', { count: slot.remainingParticipants })}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
