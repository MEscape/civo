import { FilterBar, FilterSearchField, FilterSelect } from '@components/shared/filter-bar';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { RESOURCE_TYPE_MESSAGE_KEYS } from '../../messages/message-keys';
import { RESOURCE_KIND_FILTERS } from '../../schemas/parse-resource-list-input';
import { ANY_FILTER } from '../../schemas/parse-service-list-input';

import type { ResourceListView } from '../../forms/resource-list-href';

export interface ResourcesFiltersProps extends ResourceListView {
  readonly locale: Locale;
  /** The list's own address: the filter form submits to it, and "reset" returns to it. */
  readonly base: string;
}

/** The search and the kind filter of the list, as the address. */
export async function ResourcesFilters({
  locale,
  base,
  search,
  type,
  pageSize,
}: ResourcesFiltersProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });

  return (
    <div className="border-b border-border px-4 py-3">
      <FilterBar
        key={JSON.stringify({ search, type, pageSize })}
        action={base}
        label={t('resources.filters.label')}
        applyLabel={t('resources.filters.apply')}
        resetLabel={t('resources.filters.reset')}
        resetHref={base}
      >
        <FilterSearchField
          id="resources-q"
          name="q"
          label={t('resources.filters.searchLabel')}
          placeholder={t('resources.filters.searchPlaceholder')}
          defaultValue={search ?? ''}
        />
        <FilterSelect
          id="resources-type"
          name="type"
          label={t('resources.filters.type')}
          defaultValue={type ?? ANY_FILTER}
          options={[
            { value: ANY_FILTER, label: t('resources.filters.typeAny') },
            ...RESOURCE_KIND_FILTERS.map((kind) => ({
              value: kind,
              label: t(RESOURCE_TYPE_MESSAGE_KEYS[kind]),
            })),
          ]}
        />
        <input type="hidden" name="pageSize" value={pageSize} />
      </FilterBar>
    </div>
  );
}
