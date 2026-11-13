import type { ReactNode } from 'react';

import { FilterBar, FilterSearchField, FilterSelect } from '@components/shared/filter-bar';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { PARTS_OF_DAY } from '../../../application/contracts/employee-inputs';
import { ANY_FILTER } from '../../schemas/parse-service-list-input';
import { DateField } from '../shared/date-field.client';

import type { OpenListView } from '../../forms/open-bookings';

export interface OpenBookingsFiltersProps {
  readonly locale: Locale;
  readonly base: string;
  readonly view: OpenListView;
  readonly locations: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  /** The fit chips, the first row of the same strip. */
  readonly fits: ReactNode;
}

/** The strip above the rows: the fit chips, then search, day, location and part of the day, as the address. */
export async function OpenBookingsFilters({
  locale,
  base,
  view,
  locations,
  fits,
}: OpenBookingsFiltersProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });

  return (
    <div className="divide-y divide-border border-b border-border">
      <div className="px-4 py-3">{fits}</div>
      <FilterBar
        key={JSON.stringify(view)}
        action={base}
        label={t('employee.open.filters.label')}
        applyLabel={t('employee.open.filters.apply')}
        resetLabel={t('employee.open.filters.reset')}
        resetHref={base}
        className="px-4 py-3"
      >
        <FilterSearchField
          id="open-q"
          name="q"
          label={t('employee.open.filters.searchLabel')}
          placeholder={t('employee.open.filters.searchPlaceholder')}
          defaultValue={view.q ?? ''}
        />
        <DateField
          id="open-date"
          name="date"
          label={t('employee.open.filters.date')}
          placeholder={t('employee.open.filters.date')}
          isLabelHidden
          defaultValue={view.date ?? ''}
        />
        <FilterSelect
          id="open-location"
          name="location"
          label={t('employee.open.filters.location')}
          defaultValue={view.location ?? ANY_FILTER}
          options={[
            { value: ANY_FILTER, label: t('employee.open.filters.locationAny') },
            ...locations.map(({ id, name }) => ({ value: id, label: name })),
          ]}
        />
        <FilterSelect
          id="open-part"
          name="part"
          label={t('employee.open.filters.part')}
          defaultValue={view.part ?? ANY_FILTER}
          options={[
            { value: ANY_FILTER, label: t('employee.open.filters.partAny') },
            ...PARTS_OF_DAY.map((part) => ({
              value: part,
              label: t(`employee.open.filters.parts.${part}`),
            })),
          ]}
        />
        {view.fit !== undefined && <input type="hidden" name="fit" value={view.fit} />}
      </FilterBar>
    </div>
  );
}
