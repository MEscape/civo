'use client';

import { FieldMessage } from '@components/shared/field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { addBreak, addInterval } from '../../forms/week/draft';
import { useHoursRange } from '../../hooks/use-hours-range';

import { DayHoursBar } from './day-hours-bar';
import { RangeList } from './range-list.client';

import type { DayDto } from '../../dto/location-dto';

export interface DayHoursEditorProps {
  readonly day: DayDto;
  readonly onChange: (day: DayDto) => void;
  /** What the day is called in the labels ("Monday", "the exception"). */
  readonly name: string;
  readonly idPrefix: string;
  /** The messages of this day's fields, by path inside the day (`intervals.0.end`), already translated. */
  readonly errors: Readonly<Record<string, string>>;
  readonly disabled?: boolean | undefined;
  /** Whether the bar is part of the editor; a week draws its own bars beside the fields. */
  readonly hasBar?: boolean;
}

/**
 * The hours of one day as text fields: when the place is open, in as many ranges as it has, and the
 * breaks inside them. The fields are the whole control (the bar is only a picture), so it works
 * from the keyboard and with a screen reader. It holds no state of its own and decides nothing: what
 * is valid is the server's rule, and its messages arrive in `errors`.
 */
export function DayHoursEditor({
  day,
  onChange,
  name,
  idPrefix,
  errors,
  disabled = false,
  hasBar = true,
}: DayHoursEditorProps) {
  const t = useTranslations('booking');
  const list = { dayName: name, idPrefix, errors, disabled };
  const range = useHoursRange([day]);

  return (
    <div className="space-y-3">
      {day.intervals.length === 0 && <p className="text-sm text-copy-muted">{t('hours.closed')}</p>}
      <RangeList
        kind="intervals"
        ranges={day.intervals}
        onChange={(intervals) => {
          onChange({ ...day, intervals });
        }}
        {...list}
      />
      <RangeList
        kind="breaks"
        ranges={day.breaks}
        onChange={(breaks) => {
          onChange({ ...day, breaks });
        }}
        {...list}
      />
      {errors['intervals'] !== undefined && (
        <FieldMessage id={`${idPrefix}-intervals-error`} message={errors['intervals']} />
      )}
      <div className={cn('flex flex-wrap gap-2', disabled && 'pointer-events-none')}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            onChange(addInterval(day));
          }}
        >
          {t('hours.addInterval')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || day.intervals.length === 0}
          onClick={() => {
            onChange(addBreak(day));
          }}
        >
          {t('hours.addBreak')}
        </Button>
      </div>
      {hasBar && (
        <>
          <p className="text-xs text-copy-muted">{t('workspace.hoursHint')}</p>
          <DayHoursBar
            day={day}
            onChange={onChange}
            disabled={disabled}
            name={name}
            range={range}
          />
        </>
      )}
    </div>
  );
}
