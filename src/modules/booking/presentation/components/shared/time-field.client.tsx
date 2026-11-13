'use client';

import { Input } from '@components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@components/ui/select';

import { useTranslations } from '@i18n/client';

import { MINUTES_PER_DAY, timeOf } from '../../forms/week/time';

const PICKER_STEP_MINUTES = 15;
const TIMES = Array.from({ length: MINUTES_PER_DAY / PICKER_STEP_MINUTES + 1 }, (_, index) =>
  timeOf(index * PICKER_STEP_MINUTES),
);

interface TimeFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly disabled: boolean;
  readonly 'aria-invalid'?: boolean | undefined;
  readonly 'aria-describedby'?: string | undefined;
}

/** Precise manual times and a designed quarter-hour menu share the same value, including end-of-day 24:00. */
export function TimeField({ label, onValueChange, value, ...inputProps }: TimeFieldProps) {
  const t = useTranslations('booking');

  return (
    <div className="flex w-36 min-w-0 items-center gap-1">
      <Input
        {...inputProps}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="HH:mm"
        value={value}
        className="min-w-0 tabular-nums"
        onChange={(event) => {
          onValueChange(event.target.value);
        }}
      />
      <Select
        value={TIMES.includes(value) ? value : ''}
        onValueChange={onValueChange}
        disabled={inputProps.disabled}
      >
        <SelectTrigger
          className="w-9 shrink-0 justify-center px-2"
          aria-label={t('workspace.chooseTime', { field: label })}
        />
        <SelectContent>
          {TIMES.map((time) => (
            <SelectItem key={time} value={time}>
              {time}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
