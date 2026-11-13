'use client';

import { SelectField } from '@components/shared/select-field';

import { useTranslations } from '@i18n/client';

import { speakLength, withCurrent } from '../../forms/service-length-options';

export interface LengthSelectFieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string | undefined;
  /** Whole minutes (days when `unit` is `days`). */
  readonly value: number;
  readonly choices: readonly number[];
  /** What the number counts: minutes, or days for the booking horizon. */
  readonly counts?: 'minutes' | 'days';
  /** How a choice is worded in the list: just the length, or "N before the appointment". */
  readonly wording?: 'length' | 'beforeAppointment';
  readonly error?: string | undefined;
  readonly onChange: (value: number) => void;
}

/**
 * A length of time chosen from a few usual ones, plus the value the service already has when it is
 * not among them (kept, never lost). Each choice says its unit in words ("24 Stunden", "90 Tage").
 */
export function LengthSelectField({
  id,
  label,
  hint,
  value,
  choices,
  counts = 'minutes',
  wording = 'length',
  error,
  onChange,
}: LengthSelectFieldProps) {
  const t = useTranslations('booking');

  const lengthText = (amount: number) => {
    const spoken =
      counts === 'days' ? { unit: 'days' as const, count: amount } : speakLength(amount);
    return t(`services.units.${spoken.unit}`, { count: spoken.count });
  };
  const optionText = (amount: number) => {
    if (wording === 'length') {
      return lengthText(amount);
    }
    return amount === 0
      ? t('services.units.untilStart')
      : t('services.units.beforeAppointment', { length: lengthText(amount) });
  };

  return (
    <div className="space-y-1.5">
      <SelectField
        id={id}
        label={label}
        options={withCurrent(choices, value).map((amount) => ({
          value: String(amount),
          label: optionText(amount),
        }))}
        value={String(value)}
        onValueChange={(chosen) => {
          onChange(Number(chosen));
        }}
        errorMessage={error}
      />
      {hint !== undefined && <p className="text-xs text-copy-muted">{hint}</p>}
    </div>
  );
}
