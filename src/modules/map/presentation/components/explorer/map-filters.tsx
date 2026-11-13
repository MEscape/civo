'use client';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { countActiveFilters } from '../../../application/contracts/map-constraints';

import { DateRange, NumberRange, SelectGroup } from './map-filter-groups';

import type { FilterChangeHandler } from './map-filter-groups';
import type { FilterDefinition, FilterState } from '../../../application/contracts/map-constraints';

export interface MapFiltersProps {
  readonly definitions: readonly FilterDefinition[];
  readonly state: FilterState;
  readonly onChange: FilterChangeHandler;
  readonly onReset: () => void;
}

/**
 * Filters derived from the data itself. A native `details`, open by default
 * and always reachable by keyboard; the visitor can collapse it.
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
          className="min-h-11"
          onClick={onReset}
          disabled={activeCount === 0}
        >
          {t('filters.reset')}
        </Button>
      </div>
    </details>
  );
}
