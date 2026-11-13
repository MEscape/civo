import {
  FilterBar,
  FilterChips,
  FilterSearchField,
  FilterSelect,
} from '@components/shared/filter-bar';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { SERVICE_ORIGINS } from '../../../application/contracts/booking-constraints';
import { serviceListHref } from '../../forms/service-list-href';
import { ANY_FILTER, SERVICE_STATUS_FILTERS } from '../../schemas/parse-service-list-input';

import type { ServiceListView } from '../../forms/service-list-href';

export interface ServicesFiltersProps extends ServiceListView {
  readonly locale: Locale;
  /** The list's own address: the filter form submits to it, and "reset" returns to it. */
  readonly base: string;
  /** The categories the location uses, for the category filter. */
  readonly categories: readonly string[];
}

/** The search and the three filters of the list (category, origin, status), as the address. */
export async function ServicesFilters({
  locale,
  base,
  categories,
  search,
  category,
  origin,
  status,
  pageSize,
}: ServicesFiltersProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });

  return (
    <div className="space-y-3 border-b border-border px-4 py-3">
      <FilterChips
        label={t('services.filters.status')}
        chips={SERVICE_STATUS_FILTERS.map((key) => ({
          key,
          label: t(`services.filters.statusOptions.${key}`),
          isActive: status === key,
          href: serviceListHref(
            base,
            { search, category, origin, status: key, pageSize },
            { page: 1 },
          ),
        }))}
      />
      <FilterBar
        key={JSON.stringify({ search, category, origin, status, pageSize })}
        action={base}
        label={t('services.filters.label')}
        applyLabel={t('services.filters.apply')}
        resetLabel={t('services.filters.reset')}
        resetHref={base}
      >
        <FilterSearchField
          id="services-q"
          name="q"
          label={t('services.filters.searchLabel')}
          placeholder={t('services.filters.searchPlaceholder')}
          defaultValue={search ?? ''}
        />
        <FilterSelect
          id="services-category"
          name="category"
          label={t('services.filters.category')}
          defaultValue={category ?? ANY_FILTER}
          options={[
            { value: ANY_FILTER, label: t('services.filters.categoryAny') },
            ...categories.map((name) => ({ value: name, label: name })),
          ]}
        />
        <FilterSelect
          id="services-origin"
          name="origin"
          label={t('services.filters.origin')}
          defaultValue={origin ?? ANY_FILTER}
          options={[
            { value: ANY_FILTER, label: t('services.filters.originAny') },
            ...SERVICE_ORIGINS.map((kind) => ({
              value: kind,
              label: t(`services.filters.originOptions.${kind}`),
            })),
          ]}
        />
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="pageSize" value={pageSize} />
      </FilterBar>
    </div>
  );
}
