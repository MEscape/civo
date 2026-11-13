import { FilterBar, FilterChips, FilterSearchField } from '@components/shared/filter-bar';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { locationListHref } from '../../forms/location-list-href';
import { LOCATION_STATUS_FILTERS } from '../../schemas/parse-location-list-input';

import type { LocationListView } from '../../forms/location-list-href';

export interface LocationsFiltersProps extends LocationListView {
  readonly locale: Locale;
  /** The list's own address: the search form submits to it, and "reset" returns to it. */
  readonly base: string;
}

/** The status tabs (addresses, so the view can be shared) and the search of the list. */
export async function LocationsFilters({
  locale,
  base,
  search,
  status,
  pageSize,
}: LocationsFiltersProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });

  return (
    <div className="space-y-3 border-b border-border px-4 py-3">
      <FilterChips
        label={t('locations.tabsLabel')}
        chips={LOCATION_STATUS_FILTERS.map((key) => ({
          key,
          isActive: status === key,
          label: t(`locations.tabs.${key}`),
          href: locationListHref(base, { search, status, pageSize }, { status: key }),
        }))}
      />
      <FilterBar
        key={JSON.stringify({ search, status, pageSize })}
        action={base}
        label={t('locations.filterLabel')}
        applyLabel={t('locations.apply')}
        resetLabel={t('locations.reset')}
        resetHref={base}
      >
        <FilterSearchField
          id="locations-q"
          name="q"
          label={t('locations.searchLabel')}
          placeholder={t('locations.searchPlaceholder')}
          defaultValue={search ?? ''}
        />
        {status !== 'all' && <input type="hidden" name="status" value={status} />}
      </FilterBar>
    </div>
  );
}
