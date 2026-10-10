import { useId } from 'react';

import { useTranslations } from '@i18n/client';

import { ALL_FILTER } from '../../hooks/use-operations-calendar';
import { OptionSelectField } from '../shared/option-select-field';

import type { BookingSetupDto } from '../../dto/setup-dto';
import type { CalendarFilters as Filters } from '../../hooks/use-operations-calendar';

export interface CalendarFiltersProps {
  readonly setup: BookingSetupDto;
  readonly filters: Filters;
  readonly onChange: (next: Filters) => void;
}

/** Narrow the calendar to one location, service or resource. */
export function CalendarFilters({ setup, filters, onChange }: CalendarFiltersProps) {
  const t = useTranslations('booking');
  const id = useId();

  const resourcesForFilter = setup.resources.filter(
    (resource) =>
      filters.locationId === ALL_FILTER ||
      resource.locationId === null ||
      resource.locationId === filters.locationId,
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <OptionSelectField
        id={`${id}-location`}
        label={t('calendar.filterLocation')}
        value={filters.locationId}
        options={[
          { value: ALL_FILTER, label: t('calendar.firstLocation') },
          ...setup.locations.map((location) => ({ value: location.id, label: location.name })),
        ]}
        // A resource of another location would no longer be offered, so that choice is reset.
        onValueChange={(locationId) => {
          onChange({ ...filters, locationId, resourceId: ALL_FILTER });
        }}
      />
      <OptionSelectField
        id={`${id}-service`}
        label={t('calendar.filterService')}
        value={filters.serviceId}
        options={[
          { value: ALL_FILTER, label: t('calendar.allServices') },
          ...setup.services.map((service) => ({ value: service.id, label: service.name })),
        ]}
        onValueChange={(serviceId) => {
          onChange({ ...filters, serviceId });
        }}
      />
      <OptionSelectField
        id={`${id}-resource`}
        label={t('calendar.filterResource')}
        value={filters.resourceId}
        options={[
          { value: ALL_FILTER, label: t('calendar.allResources') },
          ...resourcesForFilter.map((resource) => ({ value: resource.id, label: resource.name })),
        ]}
        onValueChange={(resourceId) => {
          onChange({ ...filters, resourceId });
        }}
      />
    </div>
  );
}
