import { OverviewPanel } from '@components/shared/data-panel';
import { ResponsiveTable } from '@components/shared/responsive-table';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { bookingRoutes } from '../../routes';
import { locationColumns } from '../locations/location-columns';
import { LocationsEmpty } from '../locations/locations-empty';

import type { LocationPageDto } from '../../dto/location-dto';

export interface OverviewLocationsProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly page: LocationPageDto;
  readonly mayConfigure: boolean;
}

/**
 * The locations with their hours of today and the ways on from each (its services, resources and team),
 * as the same table the locations page has. With none yet it is that table's empty state, so the page
 * does not change its shape the day the first location is made.
 */
export async function OverviewLocations({
  locale,
  websiteId,
  page,
  mayConfigure,
}: OverviewLocationsProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const columns = await locationColumns({
    locale,
    websiteId,
    actions: 'areas',
    mayConfigure,
  });

  return (
    <OverviewPanel
      title={t('home.locations.title')}
      meta={t('locations.count', { count: page.total })}
      link={{ href: bookingRoutes.locations(websiteId), label: t('home.locations.all') }}
    >
      <ResponsiveTable
        label={t('home.locations.title')}
        rows={page.items}
        rowKey={(location) => location.id}
        columns={columns}
        density="standard"
        state={{
          kind: 'ready',
          empty: (
            <LocationsEmpty
              locale={locale}
              websiteId={websiteId}
              isFiltered={false}
              mayConfigure={mayConfigure}
            />
          ),
        }}
      />
    </OverviewPanel>
  );
}
