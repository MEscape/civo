'use client';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { replaceAt } from '@lib/utils';

import { WEEKDAYS } from '../../../application/contracts/booking-constraints';
import { NO_HOURS, withMondayOnWorkdays } from '../../drafts/availability-plan-form';
import { useZonedFormat } from '../../hooks/use-zoned-format';

import { ExceptionsEditor } from './exceptions-editor';
import { WeekdayRow } from './weekday-row';

import type { AvailabilityPlanForm } from '../../schemas/availability-plan-schema';

export interface AvailabilityEditorProps {
  readonly value: AvailabilityPlanForm;
  readonly onChange: (next: AvailabilityPlanForm) => void;
  readonly disabled?: boolean;
}

/**
 * Edits one availability plan: the weekly pattern with breaks, and dated
 * exceptions (closures, one-off changes, extra openings). The same editor
 * serves a location's opening hours, a resource's working time and a
 * service's own restrictions, because they are the same kind of plan.
 */
export function AvailabilityEditor({ value, onChange, disabled = false }: AvailabilityEditorProps) {
  const t = useTranslations('booking');
  const format = useZonedFormat('UTC');

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-copy">{t('availability.weekly')}</h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              onChange(withMondayOnWorkdays(value));
            }}
          >
            {t('availability.copyMonday')}
          </Button>
        </div>
        <ul className="space-y-3">
          {WEEKDAYS.map((weekday, index) => (
            <WeekdayRow
              key={weekday}
              name={format.weekdayName(weekday, 'long')}
              day={value.weekly[index] ?? NO_HOURS}
              disabled={disabled}
              onChange={(next) => {
                onChange({ ...value, weekly: replaceAt(value.weekly, index, next) });
              }}
            />
          ))}
        </ul>
      </div>

      <ExceptionsEditor
        exceptions={value.exceptions}
        disabled={disabled}
        onChange={(exceptions) => {
          onChange({ ...value, exceptions });
        }}
      />
    </div>
  );
}
