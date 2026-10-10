import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { DEFAULT_RANGE } from '../../drafts/availability-plan-form';

import { DayEditor } from './day-editor';

import type { DayForm } from '../../drafts/availability-plan-form';

export interface WeekdayRowProps {
  readonly name: string;
  readonly day: DayForm;
  readonly disabled: boolean;
  readonly onChange: (next: DayForm) => void;
}

/** One weekday of the weekly pattern: "closed" with a way to open it, or its hours. */
export function WeekdayRow({ name, day, disabled, onChange }: WeekdayRowProps) {
  const t = useTranslations('booking');

  return (
    <li className="rounded-token border border-border p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <p className="text-sm font-medium text-copy">{name}</p>
        {day.intervals.length === 0 ? (
          <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
            <p className="text-sm text-copy-muted">{t('availability.closed')}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => {
                onChange({ ...day, intervals: [DEFAULT_RANGE] });
              }}
            >
              {t('availability.addHours')}
              <span className="sr-only">{name}</span>
            </Button>
          </div>
        ) : (
          <div className="sm:col-span-3">
            <DayEditor day={day} legend={name} disabled={disabled} onChange={onChange} />
          </div>
        )}
      </div>
    </li>
  );
}
