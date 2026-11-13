'use client';

import { useId } from 'react';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { errorsUnder } from '../../forms/field-errors';
import { updateDay, weekdayId } from '../../forms/week/draft';
import { readableRanges } from '../../forms/week/time';
import { hoursAndMinutes, weekMinutes } from '../../forms/week/totals';
import { useHoursRange } from '../../hooks/use-hours-range';

import { HoursAxis } from './day-hours-bar';
import { DayTimelineLegend } from './day-timeline';
import { WEEK_ROW_COLUMNS, WeekDayRow } from './week-day-row.client';
import { WeekTemplatePicker } from './week-template-picker.client';

import type { DayDto } from '../../dto/location-dto';
import type { WeekDraft } from '../../forms/week/draft';

export interface WeeklyHoursEditorProps {
  readonly value: WeekDraft;
  readonly onChange: (week: DayDto[]) => void;
  /** The messages of the week's fields, by path inside the week (`0.intervals.1.end`), already translated. */
  readonly errors: Readonly<Record<string, string>>;
  readonly disabled?: boolean | undefined;
  /**
   * The week the hours must stay inside (an employee or a resource works within its location's hours):
   * what lies outside it is shaded, cannot be drawn on and cannot be dragged into.
   */
  readonly bounds?: readonly DayDto[] | undefined;
}

/**
 * The opening hours of a week: a template to start from, then one row per weekday with its bar
 * (draw, move and stretch the hours right on it) under one shared row of hours, and the total,
 * worked out from what is set. A controlled editor: it holds no state of its own about the hours
 * and checks nothing; the form's value is the week and the messages come from the server's rules.
 */
export function WeeklyHoursEditor({
  value,
  onChange,
  errors,
  disabled = false,
  bounds,
}: WeeklyHoursEditorProps) {
  const t = useTranslations('booking');
  const idPrefix = useId();
  const range = useHoursRange(bounds === undefined ? value : [...value, ...bounds]);

  return (
    <div className="space-y-4">
      <WeekTemplatePicker value={value} onApply={onChange} disabled={disabled} />
      <p className="text-xs text-copy-muted">{t('workspace.hoursHint')}</p>

      <div className="overflow-hidden rounded-token border border-border bg-surface">
        <div
          aria-hidden="true"
          className={cn('hidden gap-3 border-b border-border px-4 py-2 lg:grid', WEEK_ROW_COLUMNS)}
        >
          <span className="text-xs font-medium text-copy-muted">{t('hours.dayColumn')}</span>
          <HoursAxis range={range} />
          <span className="text-xs font-medium text-copy-muted lg:text-end">
            {t('hours.actionsColumn')}
          </span>
        </div>
        <ul aria-label={t('hours.weekLabel')} className="divide-y divide-border">
          {value.map((_day, index) => (
            // eslint-disable-next-line react/no-array-index-key -- the days of a week have no ids
            <li key={index}>
              <WeekDayRow
                week={value}
                index={index}
                name={t(`weekdays.long.${weekdayId(index)}`)}
                idPrefix={`${idPrefix}-d${index}`}
                errors={errorsUnder(errors, index)}
                disabled={disabled}
                range={range}
                limits={
                  bounds === undefined ? undefined : readableRanges(bounds[index]?.intervals ?? [])
                }
                onDayChange={(next) => {
                  onChange(updateDay(value, index, () => next));
                }}
                onWeekChange={onChange}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <DayTimelineLegend
          open={t('hours.open')}
          closed={t('hours.closed')}
          breakLabel={t('hours.legendBreak')}
        />
        <p role="status" className="text-sm font-medium text-copy">
          {t('hours.total', hoursAndMinutes(weekMinutes(value)))}
        </p>
      </div>
    </div>
  );
}
