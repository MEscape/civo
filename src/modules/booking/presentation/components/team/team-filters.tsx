import { FilterBar, FilterSearchField, FilterSelect } from '@components/shared/filter-bar';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { ANY_FILTER } from '../../schemas/parse-service-list-input';

import type { TeamListView } from '../../forms/team-list';

export interface TeamFiltersProps {
  readonly locale: Locale;
  /** The list's own address: the filter form submits to it, and "reset" returns to it. */
  readonly base: string;
  readonly view: TeamListView;
  readonly qualifications: readonly string[];
}

/**
 * The strip above the team table, as in the other lists: the search and the qualification, all as the
 * address.
 */
export async function TeamFilters({ locale, base, view, qualifications }: TeamFiltersProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  return (
    <div className="border-b border-border">
      <FilterBar
        key={JSON.stringify(view)}
        action={base}
        label={t('team.filters.label')}
        applyLabel={t('team.filters.apply')}
        resetLabel={t('team.filters.reset')}
        resetHref={base}
        className="px-4 py-3"
      >
        <FilterSearchField
          id="team-q"
          name="q"
          label={t('team.filters.searchLabel')}
          placeholder={t('team.filters.searchPlaceholder')}
          defaultValue={view.search ?? ''}
        />
        <FilterSelect
          id="team-qualification"
          name="qualification"
          label={t('team.filters.qualification')}
          defaultValue={view.qualification ?? ANY_FILTER}
          options={[
            { value: ANY_FILTER, label: t('team.filters.qualificationAny') },
            ...qualifications.map((qualification) => ({
              value: qualification,
              label: qualification,
            })),
          ]}
        />
        <input type="hidden" name="pageSize" value={view.pageSize} />
      </FilterBar>
    </div>
  );
}
