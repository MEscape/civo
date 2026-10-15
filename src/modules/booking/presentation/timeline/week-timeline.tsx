'use client';

import { useState, useTransition } from 'react';

import { Button } from '@components/ui/button';
import { Icons } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { cn, replaceAt } from '@lib/utils';

import { WEEKDAYS } from '../../application/contracts/booking-constraints';
import {
  AVAILABILITY_PRESET_KEYS,
  NO_HOURS,
  withMondayOnWorkdays,
  withPreset,
} from '../drafts/availability-plan-form';
import { useZonedFormat } from '../hooks/use-zoned-format';

import { DayTrack } from './day-track';
import { HOUR_MINUTES, PERCENT, clipToParents, rangesOf, spansOf, windowOf } from './spans';

import type { DayTrackLabels } from './day-track';
import type { Span } from './spans';
import type { DayForm } from '../drafts/availability-plan-form';
import type { AvailabilityPlanForm } from '../schemas/availability-plan-schema';

const WIDE_WINDOW_HOURS = 12;
const OPEN_BAR_HOURS = 4;
const OPEN_BAR_MINUTES = OPEN_BAR_HOURS * HOUR_MINUTES;
const PAUSE_BAR_MINUTES = 30;

export interface WeekTimelineProps {
  /** The seven days, Monday first. */
  readonly weekly: AvailabilityPlanForm['weekly'];
  /**
   * The hours this week must stay inside (the location's, for a resource or a
   * service): shown behind the bars, and bars cannot be dragged out of them.
   * `null` for the location itself.
   */
  readonly bounds: AvailabilityPlanForm['weekly'] | null;
  readonly disabled?: boolean;
  /** What is wrong with a day (by index), so it is marked and says so; `undefined` when nothing is. */
  readonly problemOn?: (dayIndex: number) => string | undefined;
  readonly onChange: (weekly: AvailabilityPlanForm['weekly']) => void;
}

function ticksOf(window: Span): number[] {
  const hours = (window.end - window.start) / HOUR_MINUTES;
  const every = hours > WIDE_WINDOW_HOURS ? 2 : 1;
  const first = Math.ceil(window.start / HOUR_MINUTES / every) * every;
  const ticks: number[] = [];
  for (let hour = first; hour * HOUR_MINUTES <= window.end; hour += every) {
    ticks.push(hour);
  }
  return ticks;
}

/**
 * The opening hours of a week as bars on seven day tracks, with breaks as
 * smaller bars underneath: dragged, resized and added with the pointer or the
 * keyboard. A resource's or service's week passes the location's as `bounds`,
 * so what is set can never lie outside the hours the place is open. Breaks
 * follow their day: shortening the hours trims a break that no longer fits.
 */
export function WeekTimeline({
  weekly,
  bounds,
  disabled = false,
  problemOn = () => undefined,
  onChange,
}: WeekTimelineProps) {
  const t = useTranslations('booking');
  const format = useZonedFormat('UTC');
  const [isPending, startTransition] = useTransition();
  // While a bar is held the scale stays as it was, or the bar would slip away from the pointer as the week re-fits around it.
  const [heldWindow, setHeldWindow] = useState<Span | null>(null);

  const ownSpans = weekly.flatMap((day) => spansOf(day.intervals));
  const boundSpans = bounds?.flatMap((day) => spansOf(day.intervals)) ?? [];
  const window = heldWindow ?? windowOf([...ownSpans, ...boundSpans]);
  const total = window.end - window.start;

  function labelsFor(day: string, lane: 'open' | 'pause'): DayTrackLabels {
    return {
      bar: (start, end) =>
        t(lane === 'open' ? 'timeline.bar' : 'timeline.pauseBar', { day, start, end }),
      start: t(lane === 'open' ? 'timeline.start' : 'timeline.pauseStart', { day }),
      end: t(lane === 'open' ? 'timeline.end' : 'timeline.pauseEnd', { day }),
      remove: t(lane === 'open' ? 'timeline.removeHours' : 'timeline.removePause', { day }),
      keys: t('timeline.keys'),
      add: t(lane === 'open' ? 'timeline.addHours' : 'timeline.addPause'),
    };
  }

  function changeDay(index: number, next: DayForm) {
    onChange(replaceAt(weekly, index, next));
  }

  /** A change of the whole week can take a moment to draw, so the buttons say that it is being applied. */
  function applyToWeek(next: AvailabilityPlanForm['weekly']) {
    startTransition(() => {
      onChange(next);
    });
  }

  return (
    <div className="space-y-3">
      {bounds === null && (
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label={t('availability.presets.label')}
            className="flex flex-wrap gap-2"
          >
            {AVAILABILITY_PRESET_KEYS.map((key) => (
              <Button
                key={key}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || isPending}
                onClick={() => {
                  applyToWeek(withPreset({ weekly, exceptions: [] }, key).weekly);
                }}
              >
                {t(`availability.presets.${key}`)}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || isPending}
            onClick={() => {
              applyToWeek(withMondayOnWorkdays({ weekly, exceptions: [] }).weekly);
            }}
          >
            {t('availability.copyMonday')}
          </Button>
          {isPending && (
            <span role="status" className="flex items-center gap-1.5 text-xs text-copy-muted">
              <Icons.spinner className="size-3.5 animate-spin" aria-hidden="true" />
              {t('timeline.applying')}
            </span>
          )}
        </div>
      )}
      <p className="text-xs text-copy-muted">
        {bounds === null ? t('timeline.hint') : t('timeline.boundedHint')}
      </p>
      <div role="group" className="space-y-2">
        <div className="flex gap-3">
          <span aria-hidden="true" className="w-20 shrink-0 sm:w-24" />
          <div aria-hidden="true" className="relative h-4 flex-1 text-xs text-copy-muted">
            {ticksOf(window).map((hour) => (
              <span
                key={hour}
                className="absolute -translate-x-1/2"
                style={{ left: `${((hour * HOUR_MINUTES - window.start) / total) * PERCENT}%` }}
              >
                {String(hour).padStart(2, '0')}
              </span>
            ))}
          </div>
        </div>
        {WEEKDAYS.map((weekday, index) => {
          const day = weekly[index] ?? NO_HOURS;
          const name = format.weekdayName(weekday, 'long');
          const hours = spansOf(day.intervals);
          const parents = bounds === null ? null : spansOf(bounds[index]?.intervals ?? []);
          const problem = problemOn(index);
          return (
            <div key={weekday} className="flex gap-3">
              <p
                className={cn(
                  'w-20 shrink-0 self-start pt-1.5 text-sm font-medium sm:w-24',
                  problem === undefined ? 'text-copy' : 'text-danger',
                )}
              >
                {name}
              </p>
              <div
                className={cn(
                  'min-w-0 flex-1 space-y-1',
                  problem !== undefined && 'rounded-token ring-2 ring-danger/60 ring-offset-2',
                )}
              >
                <div className="h-8">
                  <DayTrack
                    spans={hours}
                    parents={parents}
                    window={window}
                    tone="open"
                    newLength={OPEN_BAR_MINUTES}
                    disabled={disabled}
                    labels={labelsFor(name, 'open')}
                    onGestureChange={(isActive) => {
                      setHeldWindow(isActive ? window : null);
                    }}
                    onChange={(next) => {
                      changeDay(index, {
                        intervals: rangesOf(next),
                        breaks: rangesOf(clipToParents(spansOf(day.breaks), next)),
                      });
                    }}
                  />
                </div>
                {hours.length > 0 && (
                  <div className="h-5">
                    <DayTrack
                      spans={spansOf(day.breaks)}
                      parents={hours}
                      window={window}
                      tone="pause"
                      newLength={PAUSE_BAR_MINUTES}
                      disabled={disabled}
                      labels={labelsFor(name, 'pause')}
                      onGestureChange={(isActive) => {
                        setHeldWindow(isActive ? window : null);
                      }}
                      onChange={(next) => {
                        changeDay(index, { ...day, breaks: rangesOf(next) });
                      }}
                    />
                  </div>
                )}
                {problem !== undefined && (
                  <p role="alert" className="text-xs text-danger">
                    {problem}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t('timeline.clearDay', { day: name })}
                title={t('timeline.clearDay', { day: name })}
                disabled={disabled || hours.length === 0}
                className="size-8 shrink-0 self-start p-0"
                onClick={() => {
                  changeDay(index, NO_HOURS);
                }}
              >
                <Icons.trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
