import { useId } from 'react';

import { Button } from '@components/ui/button';
import { Input, Label } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { removeAt, replaceAt } from '@lib/utils';

import type { RangeForm } from '../../drafts/availability-plan-form';

/** Five-minute steps: fine enough for appointments, coarse enough for a phone's time picker. */
const TIME_STEP_SECONDS = 300;

export interface RangeListProps {
  readonly legend: string;
  readonly addLabel: string;
  readonly ranges: readonly RangeForm[];
  readonly max: number;
  readonly defaultRange: RangeForm;
  readonly disabled: boolean;
  readonly onChange: (next: RangeForm[]) => void;
}

/** A list of `from - to` times. Each row is a pair of native time inputs, which phones render as a picker. */
export function RangeList({
  legend,
  addLabel,
  ranges,
  max,
  defaultRange,
  disabled,
  onChange,
}: RangeListProps) {
  const t = useTranslations('booking');
  const id = useId();

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-copy-muted">{legend}</legend>
      {ranges.map((range, index) => (
        // The list is edited by position, so the position is the identity.
        // eslint-disable-next-line react/no-array-index-key -- rows are edited by position
        <div key={`${id}-${index}`} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`${id}-${index}-start`} className="text-xs">
              {t('availability.from')}
            </Label>
            <Input
              id={`${id}-${index}-start`}
              type="time"
              step={TIME_STEP_SECONDS}
              value={range.start}
              disabled={disabled}
              onChange={(event) => {
                onChange(replaceAt(ranges, index, { ...range, start: event.target.value }));
              }}
              className="w-32"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-${index}-end`} className="text-xs">
              {t('availability.to')}
            </Label>
            <Input
              id={`${id}-${index}-end`}
              type="time"
              step={TIME_STEP_SECONDS}
              value={range.end}
              disabled={disabled}
              onChange={(event) => {
                onChange(replaceAt(ranges, index, { ...range, end: event.target.value }));
              }}
              className="w-32"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => {
              onChange(removeAt(ranges, index));
            }}
          >
            {t('availability.remove')}
            <span className="sr-only">{legend}</span>
          </Button>
        </div>
      ))}
      {ranges.length < max && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            onChange([...ranges, defaultRange]);
          }}
        >
          {addLabel}
        </Button>
      )}
    </fieldset>
  );
}
