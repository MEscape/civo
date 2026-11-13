'use client';

import { Close } from '@components/icons/icons';
import { FieldMessage } from '@components/shared/field';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/input';

import { HoursSwatch } from './hours-swatch';
import { TimeField } from './time-field.client';

import type { RangeDto } from '../../dto/location-dto';
import type { RangeKind } from '../../forms/week/change-range';

export interface TimeRangeRowProps {
  readonly range: RangeDto;
  /** Which of the two it is, drawn as the bar draws it; with `kindLabel`, absent for a plain window (a preference). */
  readonly kind?: RangeKind;
  /** What it is called where it is seen ("Open", "Break 2"). */
  readonly kindLabel?: string;
  readonly id: string;
  readonly startLabel: string;
  readonly endLabel: string;
  readonly removeLabel: string;
  readonly startError: string | undefined;
  readonly endError: string | undefined;
  readonly disabled: boolean;
  readonly onChange: (range: RangeDto) => void;
  readonly onRemove: () => void;
}

/**
 * One range as its kind (the swatch and the word the bar's legend uses), two time fields and a way
 * to remove it. The fields' own labels are read out, not shown: the kind is what a person sees.
 */
export function TimeRangeRow({
  range,
  kind,
  kindLabel,
  id,
  startLabel,
  endLabel,
  removeLabel,
  startError,
  endError,
  disabled,
  onChange,
  onRemove,
}: TimeRangeRowProps) {
  const message = startError ?? endError;
  const errorId = `${id}-error`;
  const fieldProps = (error: string | undefined) => ({
    disabled,
    'aria-invalid': error === undefined ? undefined : true,
    'aria-describedby': message === undefined ? undefined : errorId,
  });

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {kind !== undefined && kindLabel !== undefined && (
          <span className="flex w-full items-center gap-2 text-xs font-medium text-copy sm:w-28">
            <HoursSwatch kind={kind} />
            {kindLabel}
          </span>
        )}
        <Label htmlFor={`${id}-start`} className="sr-only">
          {startLabel}
        </Label>
        <TimeField
          id={`${id}-start`}
          label={startLabel}
          {...fieldProps(startError)}
          value={range.start}
          onValueChange={(start) => {
            onChange({ ...range, start });
          }}
        />
        <span aria-hidden="true" className="text-copy-muted">
          –
        </span>
        <Label htmlFor={`${id}-end`} className="sr-only">
          {endLabel}
        </Label>
        <TimeField
          id={`${id}-end`}
          label={endLabel}
          {...fieldProps(endError)}
          value={range.end}
          onValueChange={(end) => {
            onChange({ ...range, end });
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={removeLabel}
          disabled={disabled}
          onClick={onRemove}
        >
          <Close aria-hidden="true" />
        </Button>
      </div>
      <FieldMessage id={errorId} message={message} />
    </div>
  );
}
