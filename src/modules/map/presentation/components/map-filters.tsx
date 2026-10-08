'use client';

import { useId } from 'react';

import { Button } from '@components/ui/button';
import { Input, Label } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { countActiveFilters } from '../../application/contracts/map-constraints';
import { useAttributeFormat } from '../hooks/use-attribute-format';
import { useFieldLabel } from '../hooks/use-field-label';

import type {
  DateRangeFilter,
  FilterDefinition,
  FilterState,
  FilterValue,
  RangeFilter,
  SelectFilter,
} from '../../application/contracts/map-constraints';

export interface MapFiltersProps {
  readonly definitions: readonly FilterDefinition[];
  readonly state: FilterState;
  /** `null` clears the filter of that field. */
  readonly onChange: (field: string, value: FilterValue | null) => void;
  readonly onReset: () => void;
}

function toNumber(raw: string): number | null {
  const parsed = raw.trim() === '' ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function SelectGroup({
  definition,
  state,
  onChange,
}: {
  readonly definition: SelectFilter;
  readonly state: FilterState;
  readonly onChange: MapFiltersProps['onChange'];
}) {
  const t = useTranslations('map');
  const label = useFieldLabel();
  const format = useAttributeFormat();
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
        <label key={option.value} className="flex items-center gap-2 text-sm text-copy">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={selected.includes(option.value)}
            onChange={(event) => {
              handleToggle(option.value, event.target.checked);
            }}
          />
          {t('filters.option', {
            value:
              option.value === 'true' || option.value === 'false'
                ? format(option.value === 'true')
                : option.value,
            count: option.count,
          })}
        </label>
      ))}
    </fieldset>
  );
}

function NumberRange({
  definition,
  state,
  onChange,
}: {
  readonly definition: RangeFilter;
  readonly state: FilterState;
  readonly onChange: MapFiltersProps['onChange'];
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

function DateRange({
  definition,
  state,
  onChange,
}: {
  readonly definition: DateRangeFilter;
  readonly state: FilterState;
  readonly onChange: MapFiltersProps['onChange'];
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

/**
 * Filters derived from the data itself. Collapsed by default on small
 * screens (native `details`), always reachable by keyboard.
 */
export function MapFilters({ definitions, state, onChange, onReset }: MapFiltersProps) {
  const t = useTranslations('map');
  const activeCount = countActiveFilters(state);

  if (definitions.length === 0) {
    return null;
  }

  return (
    <details className="group rounded-token border border-border bg-surface" open>
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-copy">
        <span>{t('filters.title')}</span>
        {activeCount > 0 && (
          <span className="text-xs font-normal text-copy-muted">
            {t('filters.active', { count: activeCount })}
          </span>
        )}
      </summary>
      <div className="space-y-4 border-t border-border p-4">
        {definitions.map((definition) => {
          switch (definition.kind) {
            case 'select':
              return (
                <SelectGroup
                  key={definition.field}
                  definition={definition}
                  state={state}
                  onChange={onChange}
                />
              );
            case 'range':
              return (
                <NumberRange
                  key={definition.field}
                  definition={definition}
                  state={state}
                  onChange={onChange}
                />
              );
            case 'dateRange':
              return (
                <DateRange
                  key={definition.field}
                  definition={definition}
                  state={state}
                  onChange={onChange}
                />
              );
          }
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={activeCount === 0}
        >
          {t('filters.reset')}
        </Button>
      </div>
    </details>
  );
}
