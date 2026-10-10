import { useTranslations } from '@i18n/client';

import { AVAILABILITY_LIMITS } from '../../../application/contracts/booking-constraints';
import { DEFAULT_BREAK, DEFAULT_RANGE } from '../../drafts/availability-plan-form';

import { RangeList } from './range-list';

import type { DayForm } from '../../drafts/availability-plan-form';

export interface DayEditorProps {
  readonly day: DayForm;
  readonly legend: string;
  readonly disabled: boolean;
  readonly onChange: (next: DayForm) => void;
}

/** The open hours of one day and, once there are some, the breaks inside them. */
export function DayEditor({ day, legend, disabled, onChange }: DayEditorProps) {
  const t = useTranslations('booking');

  return (
    <div className="space-y-3">
      <RangeList
        legend={t('availability.hoursFor', { day: legend })}
        addLabel={t('availability.addHours')}
        ranges={day.intervals}
        max={AVAILABILITY_LIMITS.maxRangesPerDay}
        defaultRange={DEFAULT_RANGE}
        disabled={disabled}
        onChange={(intervals) => {
          onChange({ ...day, intervals });
        }}
      />
      {day.intervals.length > 0 && (
        <RangeList
          legend={t('availability.breaksFor', { day: legend })}
          addLabel={t('availability.addBreak')}
          ranges={day.breaks}
          max={AVAILABILITY_LIMITS.maxBreaksPerDay}
          defaultRange={DEFAULT_BREAK}
          disabled={disabled}
          onChange={(breaks) => {
            onChange({ ...day, breaks });
          }}
        />
      )}
    </div>
  );
}
