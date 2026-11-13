'use client';

import { useState } from 'react';

import { ChevronDown } from '@components/icons/icons';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { addBreak, addInterval } from '../../forms/week/draft';
import { formatRanges } from '../../forms/week/time';

import { CopyDay } from './copy-day.client';
import { DayHoursBar } from './day-hours-bar';
import { DayHoursEditor } from './day-hours-editor.client';

import type { DayDto } from '../../dto/location-dto';
import type { WeekDraft } from '../../forms/week/draft';
import type { HoursRange } from '../../forms/week/range';
import type { Minutes } from '../../forms/week/time';

/** The row's columns: the day, its bar, the buttons. Shared with the axis header above the rows. */
export const WEEK_ROW_COLUMNS = 'lg:grid-cols-(--civo-week-row-columns)';

export interface WeekDayRowProps {
  readonly week: WeekDraft;
  readonly index: number;
  readonly name: string;
  readonly idPrefix: string;
  readonly errors: Readonly<Record<string, string>>;
  readonly disabled: boolean;
  /** The stretch of the day every bar of the week draws. */
  readonly range: HoursRange;
  /** The stretches the place is open this day; the day's hours stay inside them. `undefined`: no limit. */
  readonly limits?: readonly Minutes[] | undefined;
  readonly onDayChange: (day: DayDto) => void;
  readonly onWeekChange: (week: DayDto[]) => void;
}

/**
 * One weekday of the opening hours, bar first: its times in words, the bar to draw them on, and
 * the quick actions ("open", "add a break"). The exact fields and "copy to other days" open under
 * the row, and stay open on their own once a field has a message.
 */
export function WeekDayRow({
  week,
  index,
  name,
  idPrefix,
  errors,
  disabled,
  range,
  limits,
  onDayChange,
  onWeekChange,
}: WeekDayRowProps) {
  const t = useTranslations('booking');
  const day = week[index] ?? { intervals: [], breaks: [] };
  const [isOpen, setIsOpen] = useState(false);
  const isExpanded = isOpen || Object.keys(errors).length > 0;
  const isClosed = day.intervals.length === 0;
  const summary = isClosed
    ? t('hours.closed')
    : [
        formatRanges(day.intervals),
        ...(day.breaks.length === 0
          ? []
          : [t('hours.breakWord', { breaks: formatRanges(day.breaks) })]),
      ].join(' · ');

  return (
    <fieldset
      disabled={disabled}
      className={cn('grid gap-3 p-4 lg:items-center', WEEK_ROW_COLUMNS)}
    >
      <legend className="sr-only">{name}</legend>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-copy" aria-hidden="true">
          {name}
        </p>
        <p className={cn('text-xs', isClosed ? 'text-copy-muted' : 'text-copy')}>{summary}</p>
      </div>
      <DayHoursBar
        day={day}
        onChange={onDayChange}
        disabled={disabled}
        name={name}
        range={range}
        limits={limits}
        hasAxis={false}
      />
      <div className="flex flex-wrap items-center gap-1 lg:justify-end">
        {isClosed ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={limits?.length === 0}
            title={limits?.length === 0 ? t('hours.closedAtLocation') : undefined}
            onClick={() => {
              onDayChange(addInterval(day, limits));
            }}
          >
            {t('hours.openDay')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onDayChange(addBreak(day));
            }}
          >
            {t('hours.addBreak')}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={isExpanded}
          aria-label={t('hours.editTimesFor', { day: name })}
          onClick={() => {
            setIsOpen(!isOpen);
          }}
        >
          {t('hours.editTimes')}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-4 transition-transform motion-reduce:transition-none',
              isExpanded && 'rotate-180',
            )}
          />
        </Button>
      </div>
      {isExpanded && (
        <div className="space-y-3 border-t border-border pt-3 lg:col-span-3">
          <DayHoursEditor
            day={day}
            name={name}
            idPrefix={idPrefix}
            errors={errors}
            disabled={disabled}
            hasBar={false}
            onChange={onDayChange}
          />
          <CopyDay
            week={week}
            index={index}
            idPrefix={idPrefix}
            disabled={disabled}
            onChange={onWeekChange}
          />
        </div>
      )}
    </fieldset>
  );
}
