import type { ReactNode } from 'react';

import { FilterBar, FilterSearchField, FilterSelect } from '@components/shared/filter-bar';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { dayOf } from '../../forms/month-calendar';
import { ANY_FILTER } from '../../schemas/parse-service-list-input';

import { PeriodFilter } from './period-filter.client';

import type { BookingNamesDto } from '../../dto/booking-dto';
import type { BookingListView } from '../../forms/booking-list-href';

export interface BookingsFiltersProps {
  readonly locale: Locale;
  /** The list's own address: the filter form submits to it, and "reset" returns to it. */
  readonly base: string;
  readonly view: BookingListView;
  readonly names: BookingNamesDto;
  /** The state chips, which are the first row of the same strip. */
  readonly states: ReactNode;
}

/**
 * The strip above the rows of the list, built like the audit trail's: the states as chips, then one form
 * with the search and the filters (the period, the location, the service, the employee), all as the address.
 */
export async function BookingsFilters({ locale, base, view, names, states }: BookingsFiltersProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  // The request's own data was read before this, so the day is per request, not baked into a prerender.
  const today = dayOf(new Date().toISOString());

  return (
    <div className="divide-y divide-border border-b border-border">
      <div className="px-4 py-3">{states}</div>
      <FilterBar
        key={JSON.stringify(view)}
        action={base}
        label={t('bookings.filters.label')}
        applyLabel={t('bookings.filters.apply')}
        resetLabel={t('bookings.filters.reset')}
        resetHref={base}
        className="px-4 py-3"
      >
        <FilterSearchField
          id="bookings-q"
          name="q"
          label={t('bookings.filters.searchLabel')}
          placeholder={t('bookings.filters.searchPlaceholder')}
          defaultValue={view.reference ?? ''}
        />
        <PeriodFilter today={today} from={view.from} to={view.to} />
        <FilterSelect
          id="bookings-location"
          name="location"
          label={t('bookings.filters.location')}
          defaultValue={view.locationId ?? ANY_FILTER}
          options={[
            { value: ANY_FILTER, label: t('bookings.filters.locationAny') },
            ...names.locations.map(({ id, name }) => ({ value: id, label: name })),
          ]}
        />
        <FilterSelect
          id="bookings-service"
          name="service"
          label={t('bookings.filters.service')}
          defaultValue={view.serviceId ?? ANY_FILTER}
          options={[
            { value: ANY_FILTER, label: t('bookings.filters.serviceAny') },
            ...names.services.map(({ id, name }) => ({ value: id, label: name })),
          ]}
        />
        <FilterSelect
          id="bookings-staff"
          name="resource"
          label={t('bookings.filters.staff')}
          defaultValue={view.resourceId ?? ANY_FILTER}
          options={[
            { value: ANY_FILTER, label: t('bookings.filters.staffAny') },
            ...names.resources
              .filter((resource) => resource.type === 'employee')
              .map(({ id, name }) => ({ value: id, label: name })),
          ]}
        />
        {view.state !== undefined && <input type="hidden" name="state" value={view.state} />}
        <input type="hidden" name="pageSize" value={view.pageSize} />
      </FilterBar>
    </div>
  );
}
