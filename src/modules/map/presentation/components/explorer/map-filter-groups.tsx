import { useId } from 'react';

import { CheckboxField } from '@components/shared/field';
import { Input, Label } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { isBlank } from '@lib/utils';

import { useAttributeFormat } from '../../hooks/use-attribute-format';
import { useFieldLabel } from '../../hooks/use-field-label';

import type {
  DateRangeFilter,
  FilterState,
  FilterValue,
  RangeFilter,
  SelectFilter,
} from '../../../application/contracts/map-constraints';

/** `null` clears the filter of that field. */
export type FilterChangeHandler = (field: string, value: FilterValue | null) => void;

/** 44px high and 16px: a field a visitor types in must not make iOS zoom the page. */
const FIELD_CLASS = 'h-11 text-base';

function toNumber(raw: string): number | null {
  const parsed = isBlank(raw) ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function SelectGroup({
  definition,
  state,
  onChange,
}: {
  readonly definition: SelectFilter;
  readonly state: FilterState;
  readonly onChange: FilterChangeHandler;
}) {
  const t = useTranslations('map');
  const label = useFieldLabel();
  const format = useAttributeFormat();
  const groupId = useId();
  const current = state[definition.field];
  const selected = current?.kind === 'select' ? current.selected : [];

  function handleToggle(value: string, isChecked: boolean): void {
    const next = isChecked ? [...selected, value] : selected.filter((entry) => entry !== value);
    onChange(definition.field, next.length === 0 ? null : { kind: 'select', selected: next });
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-copy">{label(definition.field)}</legend>
      {definition.options.map((option) => (
        <CheckboxField
          key={option.value}
          id={`${groupId}-${option.value}`}
          checked={selected.includes(option.value)}
          onChange={(event) => {
            handleToggle(option.value, event.target.checked);
          }}
          label={t('filters.option', {
            value:
              option.value === 'true' || option.value === 'false'
                ? format(option.value === 'true')
                : option.value,
            count: option.count,
          })}
        />
      ))}
    </fieldset>
  );
}

export function NumberRange({
  definition,
  state,
  onChange,
}: {
  readonly definition: RangeFilter;
  readonly state: FilterState;
  readonly onChange: FilterChangeHandler;
}) {
  const t = useTranslations('map');
  const label = useFieldLabel();
  const id = useId();
  const current = state[definition.field];
  const range =
    current?.kind === 'range' ? current : { kind: 'range' as const, min: null, max: null };

  function handleChange(part: 'min' | 'max', raw: string): void {
    const next = { ...range, [part]: toNumber(raw) };
    onChange(definition.field, next.min === null && next.max === null ? null : next);
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-copy">{label(definition.field)}</legend>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-min`}>{t('filters.minimum')}</Label>
          <Input
            id={`${id}-min`}
            type="number"
            inputMode="decimal"
            className={FIELD_CLASS}
            min={definition.min}
            max={definition.max}
            placeholder={String(definition.min)}
            value={range.min ?? ''}
            onChange={(event) => {
              handleChange('min', event.target.value);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-max`}>{t('filters.maximum')}</Label>
          <Input
            id={`${id}-max`}
            type="number"
            inputMode="decimal"
            className={FIELD_CLASS}
            min={definition.min}
            max={definition.max}
            placeholder={String(definition.max)}
            value={range.max ?? ''}
            onChange={(event) => {
              handleChange('max', event.target.value);
            }}
          />
        </div>
      </div>
    </fieldset>
  );
}

export function DateRange({
  definition,
  state,
  onChange,
}: {
  readonly definition: DateRangeFilter;
  readonly state: FilterState;
  readonly onChange: FilterChangeHandler;
}) {
  const t = useTranslations('map');
  const label = useFieldLabel();
  const id = useId();
  const current = state[definition.field];
  const range =
    current?.kind === 'dateRange' ? current : { kind: 'dateRange' as const, from: null, to: null };

  function handleChange(part: 'from' | 'to', raw: string): void {
    const next = { ...range, [part]: raw === '' ? null : raw };
    onChange(definition.field, next.from === null && next.to === null ? null : next);
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-copy">{label(definition.field)}</legend>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-from`}>{t('filters.from')}</Label>
          <Input
            id={`${id}-from`}
            type="date"
            className={FIELD_CLASS}
            min={definition.min}
            max={definition.max}
            value={range.from ?? ''}
            onChange={(event) => {
              handleChange('from', event.target.value);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-to`}>{t('filters.to')}</Label>
          <Input
            id={`${id}-to`}
            type="date"
            className={FIELD_CLASS}
            min={definition.min}
            max={definition.max}
            value={range.to ?? ''}
            onChange={(event) => {
              handleChange('to', event.target.value);
            }}
          />
        </div>
      </div>
    </fieldset>
  );
}
