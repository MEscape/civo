'use client';

import { Fragment } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { marksOf } from '../../forms/week/range';
import { MINUTES_PER_DAY, timeOf } from '../../forms/week/time';
import { useHoursDrag } from '../../hooks/use-hours-drag';

import { BREAK_HATCH, OPEN_FILL } from './hours-swatch';

import type { DayDto } from '../../dto/location-dto';
import type { HoursRange } from '../../forms/week/range';
import type { Minutes } from '../../forms/week/time';

const PERCENT = 100;
const EDGE_LABELS = {
  intervals: { start: 'hours.intervalStart', end: 'hours.intervalEnd' },
  breaks: { start: 'hours.breakStart', end: 'hours.breakEnd' },
} as const;

/** Where a minute sits on a bar that draws `range`, as a CSS percentage. */
const at = (minute: number, { from, to }: HoursRange) =>
  `${((minute - from) / (to - from)) * PERCENT}%`;

/** How far a label hangs left of its mark: the first sits on the edge, the last ends on it, the rest centre on theirs. */
function shiftOf(index: number, count: number) {
  if (index === 0) {
    return 0;
  }
  return index === count - 1 ? PERCENT : PERCENT / 2;
}

/** The hours of a day's bar, written once above a whole week of them, so every bar lines up under it. */
export function HoursAxis({ range }: { readonly range: HoursRange }) {
  const marks = marksOf(range);
  return (
    <div aria-hidden="true" dir="ltr" className="relative h-4 text-xs tabular-nums text-copy-muted">
      {marks.map((minute, index) => (
        <span
          key={minute}
          className="absolute top-0"
          style={{
            left: at(minute, range),
            transform: `translateX(-${shiftOf(index, marks.length)}%)`,
          }}
        >
          {timeOf(minute)}
        </span>
      ))}
    </div>
  );
}

interface DayHoursBarProps {
  readonly day: DayDto;
  readonly onChange?: ((day: DayDto) => void) | undefined;
  readonly disabled?: boolean | undefined;
  readonly name?: string | undefined;
  /** The stretch of the day the bar draws. */
  readonly range: HoursRange;
  /** Draws the hours under the bar; a week draws them once above all its bars instead. */
  readonly hasAxis?: boolean;
  /** The stretches the day may be open in (the place's own hours): the rest is shaded and cannot be drawn on. */
  readonly limits?: readonly Minutes[] | undefined;
}

/** What lies outside `limits` within the bar's stretch, as ranges to shade. */
function outsideOf(limits: readonly Minutes[], { from, to }: HoursRange): Minutes[] {
  const sorted = [...limits].sort((a, b) => a.start - b.start);
  const gaps: Minutes[] = [];
  let cursor = from;
  for (const limit of sorted) {
    if (limit.start > cursor) {
      gaps.push({ start: cursor, end: Math.min(limit.start, to) });
    }
    cursor = Math.max(cursor, limit.end);
  }
  if (cursor < to) {
    gaps.push({ start: cursor, end: to });
  }
  return gaps.filter(({ start, end }) => end > start);
}

/**
 * The bar of one day: where it is open and where it pauses, on a grid of three-hour marks. It is a
 * control, not a picture: press on the empty bar to open a range, drag a range to move it, drag its
 * edges to resize it; the arrow keys do the same in steps. Exact time fields stay beside it.
 */
export function DayHoursBar({
  day,
  onChange,
  disabled = false,
  name,
  range,
  hasAxis = true,
  limits,
}: DayHoursBarProps) {
  const t = useTranslations('booking');
  const drag = useHoursDrag({ day, onChange, disabled, range, limits });
  const isReadOnly = onChange === undefined;

  return (
    <div className="space-y-1" dir="ltr">
      <div
        data-hours-track
        {...drag.track}
        className={cn(
          'relative h-10 touch-none rounded-token-sm bg-border/50',
          !isReadOnly && !disabled && 'cursor-crosshair',
        )}
      >
        {limits !== undefined &&
          outsideOf(limits, range).map(({ start, end }) => (
            <span
              key={`outside-${start}`}
              aria-hidden="true"
              title={t('hours.outsideLocation')}
              className="pointer-events-none absolute inset-y-0 bg-copy/10"
              style={{
                left: at(start, range),
                width: `${((end - start) / (range.to - range.from)) * PERCENT}%`,
              }}
            />
          ))}
        {marksOf(range)
          .slice(1, -1)
          .map((minute) => (
            <span
              key={minute}
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 w-px bg-surface/70"
              style={{ left: at(minute, range) }}
            />
          ))}
        {drag.segments.map(({ kind, index, start, end }) => (
          <Fragment key={`${kind}-${index}`}>
            <Button
              type="button"
              variant="ghost"
              disabled={disabled || isReadOnly}
              aria-label={`${name ?? t('hours.open')}: ${timeOf(start)}–${timeOf(end)}`}
              {...drag.bind(kind, index, 'move')}
              title={`${timeOf(start)}–${timeOf(end)}`}
              className={cn(
                // `@container`: the label asks its own box how much room it has, so a short range
                // (the morning before a break) never writes its times over its handles; the times are
                // then in the tooltip and in the day's summary.
                '@container absolute inset-y-1 h-auto min-w-0 touch-none cursor-grab justify-center overflow-hidden rounded-token-sm p-0 text-xs font-medium tabular-nums transition-[left,width] duration-100 ease-out active:cursor-grabbing motion-reduce:transition-none',
                kind === 'intervals'
                  ? cn(
                      OPEN_FILL,
                      'text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground',
                    )
                  : cn(BREAK_HATCH, 'z-10 text-copy hover:bg-canvas'),
              )}
              style={{
                left: at(start, range),
                width: `${((end - start) / (range.to - range.from)) * PERCENT}%`,
              }}
            >
              <span aria-hidden="true" className="truncate px-4 @max-bar-label:hidden">
                {timeOf(start)}–{timeOf(end)}
              </span>
            </Button>
            {!isReadOnly &&
              (['start', 'end'] as const).map((edge) => (
                <Button
                  key={edge}
                  type="button"
                  role="slider"
                  variant="outline"
                  disabled={disabled}
                  aria-label={t(EDGE_LABELS[kind][edge], {
                    day: name ?? t('hours.open'),
                    n: index + 1,
                  })}
                  aria-valuemin={0}
                  aria-valuemax={MINUTES_PER_DAY}
                  aria-valuenow={edge === 'start' ? start : end}
                  aria-valuetext={timeOf(edge === 'start' ? start : end)}
                  {...drag.bind(kind, index, edge)}
                  title={timeOf(edge === 'start' ? start : end)}
                  className="absolute inset-y-0 z-20 h-auto w-3 -translate-x-1/2 touch-none cursor-ew-resize rounded-token-sm border-primary p-0 shadow-sm transition-[left] duration-100 ease-out motion-reduce:transition-none"
                  style={{ left: at(edge === 'start' ? start : end, range) }}
                >
                  <span aria-hidden="true" className="h-3 w-px bg-copy-muted" />
                </Button>
              ))}
          </Fragment>
        ))}
      </div>
      {hasAxis && <HoursAxis range={range} />}
    </div>
  );
}
